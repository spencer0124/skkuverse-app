---
title: Game Host Package (@skkuverse/game-host)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-26
audience: internal
---

# packages/game-host

> The contract between a bundled game page and the native screen hosting it. Read this before
> changing either end.

## Messages

| Direction | Type | Payload |
| --- | --- | --- |
| page → host | `game:ready` | — |
| page → host | `game:start` | — |
| page → host | `game:phase` | `phase` |
| page → host | `game:haptic` | `style` |
| page → host | `game:over` | `score`, `ticks`, `hit`, `revives`, `revivesLeft`, optional `stats` |
| host → page | `host:init` | `hi` |
| host → page | `host:revive`, `host:restart`, `host:reset`, `host:pause`, `host:resume` | — |

The page posts with `window.ReactNativeWebView.postMessage(JSON.stringify(message))`, and the
host parses with `parseGameMessage`. The host delivers with `injectJavaScript(hostScript(message))`,
which calls the page's `window.__host`, and the page parses with `parseHostMessage`. The host
speaks only after `game:ready`; a message sent earlier has no receiver.

Both parsers rebuild a message from its declared fields, and `game:over` counts must be safe
non-negative integers, because the score is what gets submitted. `stats` is display only (the
figures the result card shows beside the score): at most eight finite numbers under plain keys.
A malformed `stats` is dropped and the result kept.

A score is a count either way. Which way it ranks (more is better for a distance, less for a
time) is the host's to know, from the game's registry entry, never the page's to say.

## The page build

`scripts/embed.mjs` exports `embedGame`, which every game package's `build:embed` calls with its
own Vite. It builds the page entry into one IIFE, inlines every image as a data URL and the
bundle's CSS into `<style>`, fails on any other emitted file (a page loaded from a string can
fetch nothing), and writes the page as a string constant into the app.

## Why not `@skkuverse/bridge`

`packages/bridge` is vendored into skkuverse-web and hash-checked by the umbrella's contract
registry, and it speaks for pages on the open web. A bundled game never leaves this repo, so
both ends import this package directly. See
[ADR 0009](../../docs/decisions/0009-bundle-games-into-the-app.md).

## Tests

`yarn workspace @skkuverse/game-host test` (`node --test`; `protocol.ts` imports nothing).
