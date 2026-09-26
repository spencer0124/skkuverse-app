---
title: Campus Typing Package (@skkuverse/subway-typing)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-26
audience: internal
---

# packages/subway-typing

> 캠퍼스 타이핑, the typing game the app bundles into its game screen: type each station from <!-- conventions:allow-korean: the game's product name -->
> Hyehwa to Sungkyunkwan University in order, as fast as you can. Ported from the web mini app
> of the same id; the id stays `subway-typing` so the home tile and `/m/subway-typing` open it.

## Layout

| Path | Role |
| --- | --- |
| `src/data/route.ts` | The stations, in order, and the two line colours |
| `src/lib/hangul.ts`, `src/lib/judge.ts` | Judging by keystroke (두벌식), so a syllable mid-composition is never a typo <!-- conventions:allow-korean: the keyboard layout's name --> |
| `src/lib/game.ts` | The run as a pure reducer; the clock starts on the first key |
| `src/lib/stats.ts` | Keys per minute, accuracy, and `formatTime` (`m:ss.cc`) |
| `src/bound.ts` | The time floor the leaderboard rules mirror |
| `src/layout.ts` | The room the page leaves for the host's buttons and title, shared with the app's overlay |
| `src/index.ts` | What the app imports: the format, the floor, the layout |
| `src/page/` | The page: React, `host.ts` for the `@skkuverse/game-host` channel |
| `src/assets/metro.png` | Tossface's 🚇, cut from the app's font by `scripts/metro-glyph.py` |
| `scripts/build-embed.mjs` | Builds the page into `apps/mobile/src/features/games/subway-typing/html.generated.ts` |

## Commands

```bash
yarn workspace @skkuverse/subway-typing test          # route, judging, reducer, floor
yarn workspace @skkuverse/subway-typing build:embed   # rebuild the committed page
yarn workspace @skkuverse/subway-typing art           # re-cut the train (needs fontTools)
```

Rebuild and commit the page after any change here. CI rebuilds it and fails on a difference.

## Rules that bind this package

- The score is the time in whole milliseconds, and less is better. `MIN_RUN_MS` in `bound.ts` and
  `subwayTypingMinMs` in `apps/mobile/firestore.rules` are the same number; `bound.test.ts` pins
  it and the rules tests use it. Changing the route changes it.
- The start button is on the page, not native: iOS raises the keyboard only for a focus made
  inside a tap on the page itself. For the same reason `host:restart` goes back to the title.
- The page ignores `host:pause`. A typing run keeps its clock.
- `src/index.ts` and what it imports must not touch the DOM: the app compiles them.
