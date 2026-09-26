---
title: Bundle Mini Games Into the App and Guard Their Leaderboards With Rules Alone
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-25
audience: internal
---

# Bundle Mini Games Into the App and Guard Their Leaderboards With Rules Alone

> Why 초록의 파도 moved from a web mini app into the app bundle, why its page still runs in a <!-- conventions:allow-korean: the game's product name -->
> web view, and why the leaderboard trusts Firestore rules rather than a server replay. Read
> this before adding a game, or before tightening what a leaderboard accepts.

## Context

The mini games ran as web mini apps on their own origins, opened in the mini-app shell
([ADR 0006](0006-miniapp-webview-push-architecture.md)). A leaderboard needs to know who is
playing, and a web mini app cannot find out:

- The Firebase session and the App Check token live in native code only.
- The bridge is one-way, and the `app:auth-token` message it declares was never sent.
- The API's CORS grant covers the webview origin for `GET` only, so a game page could not post
  a score even with a token.
- Solving that properly is the v2 request/response protocol and a scoped token exchange
  described in the skkuverse-miniapp repo, none of which exists yet.

Meanwhile the app already has everything a leaderboard needs: Google sign-in restricted to
`@g.skku.edu`, Firestore with tested rules, and AdMob.

## Decision

### 1. A game is an app asset

The game's source moves into this monorepo as a workspace package
(`packages/wave-run`). Its build emits the whole page (script, styles, art) as one string,
committed as `apps/mobile/src/features/games/wave-run/html.generated.ts`, and a native screen
loads it into a web view from that string.

The page keeps its Canvas renderer. Porting it to Skia was the alternative. It would have
removed the web view, but it adds a native module and so a `runtimeVersion` bump and a
store release for every change to the renderer. A bundled page goes out over OTA, like any other
JS.

This does not reopen [umbrella ADR 0005](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0005-web-surfaces-dedicated-repo.md).
That ADR puts browser surfaces, meaning pages served from a host, in skkuverse-web. A bundled
game page is never served; it has no origin, cannot navigate, and speaks only to its host.

### 2. The host owns everything a run is worth

The page plays. The native screen owns the run stamp, the device best, revives, sign-in, the
profile and the leaderboard. They talk over `packages/game-host`, a contract separate from
`packages/bridge` because that one is vendored into skkuverse-web and hash-checked, and a
game's needs are not a web page's.

### 3. Leaderboards are guarded by Firestore rules alone

A score is accepted only if all of these hold, checked in `apps/mobile/firestore.rules`:

- It comes from an `@g.skku.edu` Google identity.
- It cites a run document the server stamped (`startedAt == request.time`) under the same
  uid, recently enough.
- It is no higher than the game could reach in the time since that stamp, per a ceiling that
  mirrors the engine's speed curve.
- Its nickname and campus equal the player's profile.

One entry per player, their best: it only moves up, and each run can raise it once.

The engine is deterministic, so a Cloud Function could replay a run's inputs and recompute
its score exactly. We chose not to, for now. It roughly doubles the work. The goal is to stop casual
tampering, such as a hand-written write with a made-up score. A determined player who is
willing to wait real time for a plausible score is out of scope.

## Consequences

- A player can still submit any score up to the ceiling for the time they waited, by writing
  to Firestore directly with their own token. Replay verification is the upgrade path, and the
  recorded inputs already make it possible.
- The ceiling and the engine can drift apart. `packages/wave-run/src/game/bound.test.ts`
  pins the ceiling at the same points the rules tests use, so tuning one without the other
  fails a test.
- A game change is an OTA, but the committed page must be rebuilt. CI rebuilds it and fails on
  any difference.
- Older builds keep opening the web mini app for the same registry id, so the web version
  stays deployed until those builds age out.
