---
title: In-App Games
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-26
audience: internal
---

# In-App Games

> How a bundled game runs, what its host screen owns, how a result reaches the Hall of Fame
> (the leaderboard; "Hall of Fame" is the only name players see), and what to touch when adding
> a game. Two games ship: wave-run, a distance where more is better, and subway-typing, a time
> where less is better. The decision behind the shape is
> [ADR 0009](../decisions/0009-bundle-games-into-the-app.md).

## The pieces

Everything under `apps/mobile/src/features/games/` except `registry.ts` and a game's own
folder is game-agnostic: a new game supplies a page, a registry entry and an overlay, and gets
the rest.

| Piece | Where | Job |
| --- | --- | --- |
| Game source | `packages/wave-run`, `packages/subway-typing` | The game and its page entry |
| Page build | each package's `build:embed`, through `embedGame` (`packages/game-host/scripts/embed.mjs`) | Writes the page as one string to `features/games/<id>/html.generated.ts` |
| Contract | `packages/game-host/src/protocol.ts` | Page-to-host and host-to-page messages, and their parsers |
| Registry | `features/games/registry.ts` | Per game: the page, the name, how its score reads and ranks (`score.order`, `format`), result rows, its overlay, whether it has revives or a keyboard |
| Overlay | `features/games/<id>/Overlay.tsx` | What the host draws over the page: the title (`host/stage/StageTitle`), controls, the pause card (`host/stage/PauseCard`) |
| Host | `features/games/host/` | `GameScreen` (full screen, route `/games/[id]`), the web view, run stamps, the session domain, auto-submit, rewarded revives |
| Result | `features/games/result/` | `ResultPanel` and its floating cards, `ScoreHeader`, `ReviveOffer` (`DrainButton`), `RankPromptSheet` |
| Leaderboard | `features/games/leaderboard/` | Placement domain, reads and writes, `LeaderboardTopSection` (result screen and home), `HomeHallOfFame` (the home carousel), `LeaderboardScreen` (the in-game board, route `/games/[id]/leaderboard`) |
| Player profile | `features/profile/`, route `/profile-setup` | Campus and nickname |
| Rules | `apps/mobile/firestore.rules`, the in-app games section | Profile shape, run stamps, leaderboard entries |
| Functions | `functions/src/claim-run.ts`, `functions/src/triggers/onUserProfileWrite.ts`, `functions/src/delete-account.ts` | Move a run across a sign-in; keep entries in step with the profile; delete them with the account |

## A run, end to end

1. The page loads and posts `game:ready`. The host answers `host:init` with the device best and
   stamps a run: `users/{uid}/gameRuns/{runId}` with a server `startedAt`. The stamp goes out
   before the first tap, so the clock the leaderboard trusts can only start early.
2. The first tap starts the run in the page (`game:start`). The host re-stamps only if the stamp
   cannot serve: nobody was signed in yet, someone else is now, or it is old enough that the
   rules' run window would cut a long run short.
3. The end of a run (a crash, or arriving at the last station) posts `game:over` with the
   score, the revives used and left, and optional `stats` for the result card. After the splash
   the result panel rises: the score card, then one card holding the board and the revive
   offer, and "next" at the bottom. A game without revives sends none left, so its run is final
   at once.
4. **Revive** (wave-run). While revives are left, the offer is a button whose fill drains over `REVIVE_WINDOW_MS`;
   when it is empty the button is spent and the crash is final. No ad to play makes the offer
   unavailable, and the crash final at once. A failed load is retried a few times with backoff
   (`useRewardedRevive`) before it counts as "no ad" — the button waits with a spinner meanwhile —
   because a single miss at mount otherwise hid the offer for every crash on that screen. Only an ad that reported the reward and then
   closed revives the run; the page accepts `host:revive` up to the engine's `MAX_REVIVES`.
5. **Final.** The moment the crash is final, a signed-in player with a nickname is written to
   the board if this is their best, and their line slides into place.
6. **Next.** Settles the run as it stands and sends `host:reset`, which takes the page back to
   its title. If the run could go on the board once the player signs in or picks a nickname,
   "next" first offers that in `RankPromptSheet` — once per screen, and again only after a new
   device best. "Later" carries on to the title.

   The sheet reports its own close through `onDismiss`, and gorhom also calls it after the
   sheet was taken off screen in code — with a handler from a render that still showed it. So
   "later" reads the prompt from a ref and ignores a dismiss once the prompt is gone; otherwise
   accepting "pick a nickname" would throw the run away behind the player's back. The detour
   that follows (sign-in, nickname) carries the id of the run it left from, and a later run
   never inherits it.

Backgrounding the app, or a screen over the game, sends `host:pause` and holds the countdown.
A page may ignore it: a typing run keeps its clock.

## Which way a score counts

A score is a non-negative integer either way; the registry's `score.order` says how to rank it.
Every comparison goes through `isBetter` (`leaderboard/domain.ts`): the board query
(`orderBy('score', order)`), the rank count (`>` or `<`), placing the player's line, the device
best, and `decideSubmit` (which takes the comparison as an argument, because a pure module there
cannot import another's values under `node --test`). The rules make the same call in
`isImprovement`. `score.format` is how a board line shows it (`1,234`, `1:02.34`), and
`scoreText` adds the unit for a sentence.

## Getting a result on the board

A board keeps one line per player: `leaderboards/{gameId}/scores/{uid}`, their best.
`decideSubmit` (`host/domain.ts`) names what a final crash does:

| Decision | What happens |
| --- | --- |
| `submit` | Write the new best, then count the entries above it for the rank |
| `notImproved` | Nothing to write: not above the player's best, or no score |
| `signIn` | Offered in the sheet after "next" |
| `setup` | Offered in the sheet; `/profile-setup?nickname=1` asks only what is missing |
| `otherAccount` | The run is still stamped under an account the player is no longer signed in as |
| `noRun`, `rejected` | Nothing that could be offered |

**Signing in from the sheet.** The sheet signs in right there, as the first-launch intro does.
An account that has signed in before cannot absorb the anonymous one, so the uid changes and
the run on screen is left stamped under the anonymous uid. Before signing in, the client keeps
the anonymous account's ID token; afterwards it calls `claimRun`, which verifies that token and
copies the stamp — `startedAt` unchanged — to the new uid. While the sign-in and the claim are
in flight no decision is made, so the run is not called someone else's in between.

**Coming back.** After signing in or picking a nickname, the run is written, the board shows it
for a moment, and the game moves on to its title by itself. A player who backed out goes
straight on.

## The player profile

`users/{uid}.profile` holds `campus` (required) and `nickname` (asked for with the first
leaderboard entry, shared by every game).

- **When it is asked for.** After the first-launch intro's sign-in, when there is none. The
  notices wizard fills the campus from its own answer, without overwriting a profile that
  exists. Everyone else is asked on the way to their first leaderboard entry, and the setup
  screen preselects what this device's notices onboarding already knows.
- **What the rules hold it to.** Any change is server-stamped. Once a nickname exists it
  cannot be removed, and a change to nickname or campus waits for the interval in
  `isProfileChangeAllowed`, because each change rewrites the player's entries.
- **The masked email.** An entry stores up to three leading characters of the email's local
  part (`emailPrefixOf`), and the rules check it against the signed-in address. The board
  shows it followed by `***`.

## What the leaderboard trusts

The rules are the only guard; the reasoning is in ADR 0009. An entry must come from an
`@g.skku.edu` Google identity, be the caller's own document, cite the caller's own run of this
game within the run window, be plausible for the time since its stamp (`isPlausible`), stay
under the game's absolute cap (`maxEntryScore`) and revive cap (`maxRevives`), and match the
profile. An update must also be better (`isImprovement`) and cite a run newer than the one it
replaces, so each run counts once.

What "plausible" means is per game:

- **wave-run** has a ceiling, `waveRunMaxScore`, mirrored by
  `packages/wave-run/src/game/bound.ts`. Change a speed or scoring constant and both move.
- **subway-typing** has a floor, `subwayTypingMinMs`: the whole route at `MIN_MS_PER_KEY`, mirrored
  by `packages/subway-typing/src/bound.ts`. A time also cannot be longer than has passed since
  the stamp. Change the route and both move.

Both packages' tests pin the numbers the rules tests use.

> [!WARNING]
> The page build must never expose the engine's debug options (starting speed, starting score,
> a single obstacle kind). They are exactly what the ceiling assumes a run cannot do. `main.ts`
> creates games with no options.

## The board, anywhere

`LeaderboardTopSection` draws a top N with the player's line placed into it — their best, or a
ghost where an unsubmitted score would rank — and always N places, blank where nobody is yet.
Lines keep their key (the uid), so a line that climbs slides up rather than re-appearing. The
result screen passes its own line; without one, the section shows the signed-in player's best,
which is how the home screen uses it. `boardLines` (`leaderboard/domain.ts`) holds the placement
rules and their tests.

On home, one Hall of Fame card (`HomeHallOfFame`) holds every game on the screen, a page each —
its name, then its podium (`HOME_LIMIT` places) — turning over like the banner (`components/LoopingPager`, shared
with it). A player further down gets their line right under the podium, with no "⋯" between;
once any game has one, every page keeps that line's room, so the carousel holds one height. It sits under the first grid holding a game's tile; a game no server grid holds gets a
"mini games" grid of its own, fixed in the app, and when no server grid holds any, the card goes
under that. "View all" opens the board of the game on screen.

That board (`LeaderboardScreen`, the trophy in a game, or "view all" on home) is a card floating
over whatever opened it: a `transparentModal` route that fades in over the dimmed game or home,
closed by its X or a tap outside. It shows `BOARD_SIZE` places plus the player's line, and is
the SDS `GlassCard` — Liquid Glass on iOS 26+, a white card below — the same card the result
screen's cards are.

## Adding a game

1. Put the game in a workspace package with a `build:embed` that calls `embedGame` and writes
   `apps/mobile/src/features/games/<id>/html.generated.ts`. Add the package to the root
   `typecheck` and `test` scripts, and a CI drift check beside the others.
2. Have the page speak `@skkuverse/game-host`, including `host:reset`. It can read the safe area
   from the `--inset-*` CSS variables the host sets.
3. Add the id to `NATIVE_GAME_IDS` (`ids.ts`), an entry to `NATIVE_GAMES` (`registry.ts`), its
   overlay, and its screen names to `SCREEN_NAMES` in `app/_layout.tsx`. Use the id the mini-app
   registry already has, so its home tile and `/m/<id>` link open the native screen.
4. In `firestore.rules`, add the id to `isGameId`, and its cases to `isPlausible`,
   `maxEntryScore`, `maxRevives` and `isImprovement`, with rules tests. Add the id to `GAME_IDS`
   in `functions/src/games/claimRun.ts`.
5. Deploy rules, then functions, then the OTA.

## Deploy order

The `scores.uid` collection-group index must exist before the functions that query it, or
`deleteAccount` fails for every account. Deploy `firestore:indexes`, wait for the build to
finish, then `firestore:rules`, then functions, then publish the app.
