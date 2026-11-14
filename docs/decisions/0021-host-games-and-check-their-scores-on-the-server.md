---
title: Host Mini Games on Their Own Origins and Check Their Scores on the Server
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-27
audience: internal
---

# 0021. Host mini games on their own origins and check their scores on the server

> Why a mini game is now a static site in skkuverse-mini that the app hosts by URL, why games
> get a trust list, a registry and grants of their own, and why the app sends a leaderboard
> result to a callable function instead of writing the entry itself. Read this before adding a
> game, before changing what a game page may ask the host for, or before changing how a result
> reaches a board.

## Status

Accepted on 2026-10-22. Supersedes [0009](0009-bundle-games-into-the-app.md). Games moved one
at a time, with bundled and hosted games side by side, until the last step removed the bundled
pages on 2026-10-22: the app now hosts every game, and bundled pages exist only in builds
already installed. Which games open is whatever skkuverse-server's `games` dataset lists.

## Context

ADR 0009 made each game an app asset: a workspace package built into one HTML string, loaded
from that string by a native screen that speaks `packages/game-host` to it. The app wrote
leaderboard entries to Firestore itself. Repeating that for four games showed the cost:

- **Adding a game touched a dozen places outside it.** Root scripts, the CI embed drift check,
  the ESLint list of game pages, every consumer of the game ids, and the backend. The game-page
  lint list had already drifted and named only two of the four.
- **Every game edit was a full app OTA**, carrying every game.
- **Games spoke a second protocol** next to the mini-app one: `window.__host` with `game:*`
  and `host:*` messages.

The owner wants to make games repeatedly and, later, to open the platform. Mini apps already
had the right shape in skkuverse-mini: one folder per app, a check, `pnpm ship` to Cloudflare
Pages, and a server registry. The miniapp protocol had also grown the envelope 0009 lacked
(requests with exactly one response, host events). The reasons 0009 gave for bundling were the
missing protocol and the missing way to post a score, and both are gone.

## Decision

### 1. A game is a static site in skkuverse-mini

Each game is a folder `games/<id>/` in skkuverse-mini, built with Vite to a static site with
hashed same-origin scripts and deployed by `pnpm ship <id>` to the Pages project `game-<id>`,
served at `<id>.game.skkuverse.com`. `ship` writes the game headers, which allow scripts,
connections and media from the game's own origin only (`tools/miniapp-cli/src/platform.ts` in
skkuverse-mini). Games and mini apps share the CLI, the spec with its rule IDs and one id
namespace, so a `/m/<id>` link or an analytics item id names either kind and never both.

The CSP is defence in depth. Whoever can deploy the Pages project can change the page, so the
boundary that holds on the device is the host's grants.

### 2. Trust is per kind

Nothing that grants trust is shared between the two kinds.

| | Mini app | Game |
| --- | --- | --- |
| Origin list in `GET /app/config` | `webview.bridgeOrigins`, `miniapps.origins` | `games.origins`, an origin → id map |
| Server code | `MINIAPP_ID_BY_FIRST_PARTY_ORIGIN` | `GAME_ID_BY_FIRST_PARTY_ORIGIN` (skkuverse-server `src/infra/origins.ts`) |
| Registry | `GET /miniapps` | `GET /games`, `GET /games/:id` |
| App host | The mini-app shell | The game screen (`/games/[id]`) |
| Grants | Mini-app methods only | `game.*` notifications only (`GAME_GRANTS`) |

A game origin is never in a mini-app list, so the mini-app shell, `openWebView`'s mini-app
routing and the server's shell-manifest poller never see one. The game screen decides each
message's grant from the origin of the document that posted it, checked against the origin
`games.origins` maps to the opened id. It refuses navigation away from that origin and answers
any request `unsupported`. The mini-app shell is typed to grant mini-app methods alone, so it
drops `game.*`. Umbrella ADR 0005's
fourth invariant applies to games too: a new game origin grants nothing until the server lists
it.

An entry in the games registry says whether and where a game opens, and nothing else. It has an
id, the `entryUrl` on the origin mapped to that id, an `enabled` flag and a `minHostProtocol`.
Its title, copy, overlay, colours, score format and board live in the app's first-party
config. An entry the build has no config for is ignored, so a new game still needs an app
release until a later change makes the host config manifest-driven.

*Alternative:* games under `.mini.` with a kind flag on the shared origin map. Every consumer
would have to learn to exclude games, and one miss hands a game every mini-app grant.

### 3. One protocol, in `@skkuverse/miniapp`

Games speak the miniapp envelope, under a `game.*` namespace added in `@skkuverse/miniapp`
0.4.0 (0.4.1 adds the bootstrap's origin gate and bootGame's late-host search). The page notifies `game.ready`, `game.start`, `game.phase`, `game.layout`, `game.haptic`
and `game.over`. The host sends the events `game.init`, `game.pause`, `game.resume`,
`game.sound`, `game.reset`, `game.restart` and `game.revive`. The envelope version is
unchanged. `game.init` carries the host's game protocol (`GAME_PROTOCOL`), so a page built for a
newer host treats what this one lacks as absent. `minHostProtocol` in the registry is kept for a
page change a host cannot degrade around.

A page boots through `bootGame` from `@skkuverse/miniapp/game`. It installs the page guard
(moved there from `packages/game-host`) before the game's code runs, then keeps trying, for a
bounded time, until `window.skkuverse` exists before it sends `game.ready`. It starts no run
before `game.init`. The host injects its bootstrap before content loads and again when loading
ends, since Android can run the first injection on a document it then replaces. A hosted page
cannot use the old channel: a `game:*` message has no method, so it never parses.

`window.__host`, the `game:*`/`host:*` messages and `packages/game-host` served only the
bundled pages and were removed with them.

### 4. Runs and results go through callables

The app writes neither a run nor a board entry. It calls two callable functions and only reads
`users/{uid}/gameRuns` and `leaderboards/{gameId}/scores`:

- **`startRun`**. The app calls it with `{ gameId, runId }` when it arms a run, under
  whatever account is signed in. The app picks the run id itself, so arming a run stays
  synchronous. After a sign-in that changes the uid, the app calls `claimRun` to move the run.
- **`submitScore`**. The app calls it with the entry's fields and the scoring version the page
  names, and shows the rank it returns. The app maps each error code onto a
  submission state ([in-app-games.md](../explanation/in-app-games.md#getting-a-result-on-the-board)).

A page names its scoring version, `<gameId>@<n>`, in `game.over`, and the host passes it
through unread. While a build still bundled a page, that page's version came from the
first-party config. Every build with this path submits every ranked result through
`submitScore`, bundled or hosted.

*Alternative:* keep client writes. A result written by the client is only as trustworthy as the
client, and every scoring change would still need a backend deploy beside the page.

### 5. The registry controls exposure, and rollback follows from it

The app resolves a game id to one of three states:

| State | When | What opens |
| --- | --- | --- |
| Hosted | Listed, enabled, `minHostProtocol` within this host's game protocol | The page at `entryUrl` |
| Hidden | Listed but disabled or too new | Nothing. No tile is shown, and a link opens home |
| Unknown | Not listed, or the registry unreachable with nothing cached | Nothing. No tile is shown, and a link opens home |

During the migration a fourth state, bundled, opened a build's own copy of an unlisted game,
and of any bundled game while the registry was unreachable with nothing cached. It went with
the bundled pages.

A tap or a link that arrives before the registry has answered waits for it, with the read
timeout and the cached copy a mini-app detail uses.

Rollback follows from the states. During the migration, a game whose registry entry was removed
went back to its bundled page. With the bundled pages gone, disabling or removing the entry
hides the game, and that is the only switch. It takes effect within the registry's cache
lifetime, and it hides the game without unpublishing its page. A bad app bundle is rolled back
as any OTA is.

### 6. What a run is worth stays native

The result panel, the revive offer with its rewarded ad, the overlays, the copy, the board, the
Hall of Fame and the player profile stay in the app and import no game source. A page reports a
rectangle the host draws over in `game.ready` and `game.layout`, and suika's title is placed in
the rectangle its page reports.

### 7. Release

The change is JS-only (no native module), so it reaches players by OTA, verified on a beta
build first. Binaries up to 3.6.0 run expo-updates and keep their bundled games.
An Android check on a physical device gates the first hosted release, since the bootstrap's
timing on a remote page is not verified there.

### 8. App Store guideline 4.7

Guideline 4.7 allows an app to offer HTML5 mini apps and mini games that are not embedded in the
binary, and forbids exposing native platform APIs to that software without Apple's permission.
The games are first-party HTML5 pages. A page never reaches a native API. It sends semantic
notifications (a haptic style, a phase, a result), and the host decides what each one does.
Sign-in, ads, storage and the board stay with the host. A haptic and an ad-gated revive are
host features a page asks for by name, which is how this decision reads 4.7. Before a game
method is added, check that it does not give a page a device capability.

## Consequences

- **A game change is a `pnpm ship` in skkuverse-mini**, with no app OTA, as long as the host's
  first-party config for it does not change. A new game still needs an app release for that
  config.
- **A hosted game's first open needs the network.** The HTML is revalidated, so the web view's
  cache does not make it open offline. The host shows a retry state, and no run starts on a page
  that never said ready. subway-typing, played on the subway, migrates last for this reason.
- **A callable sits between a run and its board line.** A cold start can delay the result's rank.
  The write already happens after the result panel rises.
- **A game had a bundled and a hosted page during the migration.** `packages/game-host`, the
  game packages and their embed checks went with the last bundled page (2026-10-22).
  The app hosts every game; bundled pages live on only in installed builds: binaries up to
  3.6.0, and a store binary's embedded bundle, which hot-updater falls back to after a rollback.
- **The registry must list a game before the app shows it.** With nothing bundled, a build that
  cannot read the registry and has no cached copy shows no game tile, and a game link opens home.
