---
title: Bundle Mini Games Into the App
type: adr
status: superseded
owner: team@skkuverse.com
last-updated: 2026-10-27
audience: internal
---

# Bundle Mini Games Into the App

> Why 초록의 파도 moved from a web mini app into the app bundle, why its page still runs in a <!-- conventions:allow-korean: the game's product name -->
> web view, and how its leaderboard was first written. Read this for the history behind the
> bundled game pages.

## Status

Superseded on 2026-10-22 by [0021](0021-host-games-and-check-their-scores-on-the-server.md):
games become static sites on their own origins that the app hosts by URL, and a result
reaches the leaderboard through the `submitScore` callable. The bundled pages stay in builds
installed before that change, as 0021 describes. The current mechanism is
[in-app-games.md](../explanation/in-app-games.md).

Accepted in 2026-09, when wave-run and subway-typing moved into the app.

## Context

The mini games ran as web mini apps on their own origins, opened in the mini-app shell
([ADR 0006](0006-miniapp-webview-push-architecture.md)). A leaderboard needs to know who is
playing, and a web mini app cannot find out:

- The Firebase session and the App Check token live in native code only.
- The bridge is one-way, and the `app:auth-token` message it declares was never sent.
- The API's CORS grant covers the webview origin for `GET` only, so a game page could not post
  a score even with a token.
- Solving that properly is the v2 request/response protocol and a scoped token exchange
  described in the mini-app repository, none of which exists yet.

Meanwhile the app already has everything a leaderboard needs: Google sign-in restricted to
`@g.skku.edu`, Firestore, and AdMob.

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

This does not reopen umbrella ADR 0005, which is kept outside this repository.
That ADR puts browser surfaces, meaning pages served from a host, in skkuverse-web. A bundled
game page is never served; it has no origin, cannot navigate, and speaks only to its host.

### 2. The host owns everything a run is worth

The page plays. The native screen owns the run stamp, the device best, revives, sign-in, the
profile and the leaderboard. They talk over `packages/game-host`, a contract separate from
`packages/bridge` because that one is vendored into skkuverse-web and hash-checked, and a
game's needs are not a web page's.

### 3. The host writes the leaderboard entry

The host writes the player's entry to `leaderboards/{gameId}/scores/{uid}` itself, citing the
run it stamped and copying the nickname and campus from the player's profile. One entry per
player holds their best. ADR 0021 replaced this client write with the `submitScore`
callable.

## Consequences

- A game change is an OTA, but the committed page must be rebuilt. CI rebuilds it and fails on
  any difference.
- Older builds keep opening the web mini app for the same registry id, so the web version
  stays deployed until those builds age out.
