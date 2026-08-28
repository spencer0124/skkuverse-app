---
title: Campus Map Reconciliation
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-28
audience: internal
---

# Campus Map Reconciliation

> The order of events behind the campus suggestion card: what fires, what decides, and which
> rule wins when two apply. Read this before changing when the card appears — the rules mask
> each other, and the failure mode is silence rather than an error.

The decision behind all of this, and why it is shaped this way, is
[ADR 0008](../decisions/0008-campus-camera-reconciliation.md). This document is the mechanism.

## The pieces

| Piece | File | Job |
| --- | --- | --- |
| `resolveCampusSuggestion` | `apps/mobile/src/features/map/utils/campusProximity.ts` | Pure decision: coordinates in, suggestion or `null` out |
| `CampusSuggestionCard` | `.../components/CampusSuggestionCard.tsx` | Renders one line: statement, filled verb button, optional ✕ |
| `CampusScreen` | `.../CampusScreen.tsx` | Holds the session flags and decides which rule applies |
| `useLocationTracking` | `.../hooks/useLocationTracking.ts` | Permission state, and whether a locate press actually turned tracking on |

## What fires, in order

```text
user acts
   │
   ├─ taps the campus toggle ──────────► handleCampusPick
   │                                      • userPickedCampus  := true
   │                                      • awaitingLocateResult := null
   │                                      • clears any visible card
   │                                      • same campus  → recentre only
   │                                        other campus → set campus (effect recentres)
   │
   └─ taps locate ────────────────────► handleLocatePress
                                          • awaitingLocateResult := now
                                          • await cycleMode()
                                          • not activated → awaitingLocateResult := null
                                                     │
                                                     ▼
                                            SDK moves the camera
                                                     │
                                                     ▼
                                            onCameraIdle  ─► handleCameraIdle
```

Everything converges on `handleCameraIdle`. It is the only place a card is ever set.

## Inside `handleCameraIdle`

1. **Decide.** `resolveCampusSuggestion` compares the camera centre against each campus centre.
   - Inside the selected campus → `null`
   - Inside another campus → `switch` for that campus
   - Inside neither → `show` for the nearest, which may be the campus already selected

2. **Is a locate press still outstanding?** True only when `awaitingLocateResult` is set, with
   its expiry window not yet passed.

3. **`null` — nothing to say.** Clear any card and the dismissal memory, so the next
   disagreement starts fresh. **The locate press is not consumed here** — see the trap below.

4. **A decision exists, so the press is answered.** `awaitingLocateResult := null`.

5. **From a locate press?**
   - `switch` → set the campus **silently**, suppressing the camera effect. The user asked
     where they are; they are on that campus, and re-framing its centre would undo the move
     they just asked for.
   - `show` → put up the card. This runs even after an explicit toggle pick, because it is the
     answer to a question the user asked a second ago.

6. **Otherwise it is drift.** Suppressed if the user has picked a campus this session, or if
   this exact suggestion (`campus:variant`) was dismissed. Otherwise the card appears.

Permission outranks all of it at render time: with `permissionGranted === false` the row shows
the permission card instead, with no ✕. `null` means the first check has not landed yet, which
is not a refusal, so nothing is shown for it.

## The trap: the idle that arrives before the camera moves

Switching tracking on makes the SDK emit a camera-idle **while the camera is still at the old
position**. At that moment the map and the toggle usually still agree, so the decision is
`null` and there is nothing to do — but if that idle consumes the locate press, the real answer
arrives later and is read as ordinary drift. Combined with rule 6 it is then silently
suppressed, and the button appears to do nothing at all.

Two rules that each look right in isolation mask each other, and there is no error to see. It
was found by driving the simulator, not by reading the code.

The fix is in step 3: **a press is answered by a decision, not by an idle.** The expiry window
covers the other direction — a press whose camera never produces a decision (the user was
already on the right campus) would otherwise leave a flag standing that turns some later,
unrelated pan into a silent campus switch.

## Why `onCameraIdle`

`onCameraChanged` fires on every frame of a pan; `onCameraIdle` is withheld until a gesture has
fully ended and until an animation completes. The question here is "where did the camera come to
rest", so idle answers it directly and needs no debouncing. Both are forwarded through
`CampusNaverMap`; the bearing-tracking compass uses the former, this uses the latter.

## Gotchas worth keeping

- **`GlassView` renders nothing inside a Reanimated `Animated.View` with an `entering` layout
  animation.** The card first shipped fully transparent, with map markers showing through its
  text. Every glass surface that works in this app is mounted plainly. If the card ever needs to
  animate in, drive it from the parent's own animated style rather than a layout animation
  wrapped around it. An animated style is not the same thing as `entering`, and the sheet's own
  glass card does sit under one — see
  [campus-sheet-liquid-glass.md](campus-sheet-liquid-glass.md), which also covers why glass must
  never be shaped by a rounded `overflow: 'hidden'` parent.
- **The card shares the lower row with the locate button** at `MAP_CONTROL_HEIGHT`, mirroring
  the toggle and filter button at the top. `controlMetrics.ts` exists so those four cannot drift
  apart.
- **The SDS segmented control's indicator follows the track it is given.** It reads the
  `borderRadius` off the style passed to the track and insets by the track's padding. Before
  that it was a fixed radius pinned by `top` with a percentage height, which overflowed the
  bottom edge and was hidden by clipping — a capsule track held a clipped rounded rectangle, and
  it read as the wrong size rather than the wrong shape.
