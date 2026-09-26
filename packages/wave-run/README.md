---
title: Wave Run Package (@skkuverse/wave-run)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-25
audience: internal
---

# packages/wave-run

> 초록의 파도, the runner the app bundles into its game screen: a deterministic engine, a <!-- conventions:allow-korean: the game's product name -->
> Canvas renderer, and the build that turns both into one page string.

## Layout

| Path | Role |
| --- | --- |
| `src/game/constants.ts` | Every tunable number, including `MAX_REVIVES` |
| `src/game/engine.ts` | `createGame`, `beginRun`, `step`, `revive`: pure, seeded, fixed 60 Hz ticks |
| `src/game/bound.ts` | The score ceiling the leaderboard rules mirror |
| `src/game/loop.ts` | The frame loop, driven by the host after a crash |
| `src/game/render/` | Canvas drawing and the day/night palette |
| `src/sound/` | 8-bit sound: ZzFX tones rendered in the page, and the cue for each moment |
| `src/main.ts` | Page entry: canvas, input, and the `@skkuverse/game-host` channel |
| `scripts/build-embed.mjs` | Builds the page into `apps/mobile/src/features/games/wave-run/html.generated.ts` |
| `scripts/skyline-art.mjs` | Regenerates the skyline PNGs |

## Commands

```bash
yarn workspace @skkuverse/wave-run test          # engine, revive, ceiling
yarn workspace @skkuverse/wave-run build:embed   # rebuild the committed page
```

Rebuild and commit the page after any change here. CI rebuilds it and fails on a difference.

## Rules that bind this package

- The engine never reads the clock or `Math.random`, so a run replays exactly from its seed and
  recorded inputs, revives included.
- `bound.ts` and `waveRunMaxScore` in `apps/mobile/firestore.rules` compute the same curve.
  Changing a speed or scoring constant means changing both; `bound.test.ts` pins the values the
  rules tests use.
- The page must not reach the engine's debug options. See
  [in-app-games.md](../../docs/explanation/in-app-games.md).
