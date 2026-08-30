---
title: Event Map Status Derives Against the Device Clock
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-30
audience: internal
---

# 0007. Derive event map status against the device clock

## Status

Accepted — 2026-08-27. **Amended 2026-08-30**: the snapshot tier this ADR reasons about was deleted
server-side, so the premise in Context no longer holds — there is no `immutable, max-age=1y` payload
and no `status` field on the wire. **The decision is unchanged and now applies more widely.**
Openness is derived on the device from `hours[]` on the ordinary marker wire
(`packages/shared/src/map/window.ts`), the clock is still uncorrected, and the reason is still the
one below: a cached map on a dead network must keep telling the truth. Read every mention of
"snapshot" here as "the marker payload", and see
[eventmap-rendering.md §5](../explanation/eventmap-rendering.md) for the current design.

## Context

The event map snapshot is served `immutable, max-age=31536000`, so it cannot also carry
live status. It returns `status` as of `materializedAt` plus the `startAt`/`endAt` instants,
and the device re-derives. A booth that never flips to 운영중 at 18:00 is the failure <!-- conventions:allow-korean: the literal string the app shows -->
everyone at the festival sees, so getting that right is the feature rather than a detail.

Because the re-derivation reads a clock the server does not control, a reconciliation layer
was built around it. It measured skew from the manifest response's `Date` header, refused
any response carrying `Age > 0` (RFC 9111 §5.1 — a cached response replays the origin's
original `Date`, so the snapshot's own header would have put the offset a day out),
persisted the result for a week, and derived against `Date.now() + offset`. It reached
across `eventmap/clock.ts`, a `safeGetTimed` sibling of `safeGet` in the shared HTTP
helper, a persisted key in the Zustand store, and an `Access-Control-Expose-Headers` entry
on the server that existed only so the client could read those two headers.

The premise was that a device might not be on KST. **That premise does not survive
inspection.** A device set to the wrong timezone still has a correct epoch clock:
`Date.now()` is UTC-based, and the zone setting changes only how a time is *formatted*.
The bounds are absolute instants rather than wall-clock strings, so the device's zone never
entered the comparison in the first place — a phone set to Bangkok derives exactly what a
phone set to Seoul does.

What the layer actually defended against was a device whose *clock* is wrong: manually set,
a dead RTC, or one that has never reached NTP. That is a real failure, but a much rarer one
than the timezone case it was reasoned from, and the machinery is disproportionate to it.

## Decision

**Derive against `Date.now()`, uncorrected.**

- Remove the offset measurement, its persistence, and its application.
- Remove `safeGetTimed` and `TimedPayload` from the shared API surface; the manifest and
  snapshot fetches go back to `safeGet`.
- Narrow the server's `Access-Control-Expose-Headers` from `Date, ETag, Age` to `ETag`,
  which is unrelated — it is the revalidation token, and a browser client cannot make a
  conditional request without it.
- **Keep the re-derivation and the local boundary timer.** `deriveItemStatus`,
  `nextBoundaryAfter` and the `statusEpoch` counter are the feature, not the defense: a
  cached snapshot must still flip a booth's status on a dead network, which is the actual
  festival condition.
- **Keep the `timezone` passthrough field** on the snapshot. Nothing reads it today; it is
  the natural source for the festival's zone when the warning below is built.

Planned, and deliberately not part of this change: a warning shown when the device timezone
is not `Asia/Seoul`.

## Consequences

- (+) Around 370 lines leave the client across 11 files, and the shared HTTP helper drops a
  second GET path that existed for one caller.
- (+) A re-render loop goes with it. `setClockOffset` wrote a fresh object into the store on
  every manifest poll, and `useEventMap` subscribed to it — so under Zustand's default
  `Object.is` every consumer re-rendered roughly every 15 s during an event, with one MMKV
  write per poll. Derivation itself never re-ran, so this was pure churn.
- (−) A device whose clock is wrong now shows wrong booth status, uncorrected.
  A phone three hours fast reads a 22:00 주점 as already open. <!-- conventions:allow-korean: the venue type, as the app labels it -->
- (−) **The planned warning is not equivalent cover, and must not be described as if it
  were.** It catches a misconfigured zone; this ADR gives up correction for a misconfigured
  clock. Those failures are disjoint, so the warning closes none of the gap opened here.
- (−) The store's persist version goes 1 → 2 with a migration that drops the stored
  `clockOffset`. That is one-directional: an OTA rollback to a pre-change bundle finds v2 in
  MMKV, cannot migrate down, and resets layer visibility, chips and sort to defaults.

## Revisit if

Booth status is reported wrong by a user whose device clock, not zone, turns out to be off.
That is the case this ADR trades away, and one confirmed instance is enough to reopen it —
the cheap answer then is to derive against `Date.now()` but *warn* on a large measured skew,
rather than to rebuild the persisted-offset machinery removed here.

Related: `docs/explanation/eventmap-rendering.md` §5 is the SSOT for how derivation works,
and the server contract is `skkuverse-server` `docs/reference/eventmap-api.md` §9.
