/**
 * Server clock reconciliation and status derivation.
 *
 * The snapshot is served `immutable, max-age=1y`, so it cannot also carry live
 * status. It ships `status` as of `materializedAt` plus the `startAt`/`endAt`
 * instants, and the device re-derives. Getting that right is the whole feature:
 * a booth that never flips to open at 18:00 is the failure everyone sees.
 *
 * Two traps, both of which the obvious design walks into.
 *
 * ## 1. Which response's `Date` you read
 *
 * Only the MANIFEST's (`max-age=15`). Never the snapshot's.
 *
 * RFC 9111 §5.1: `Age` conveys time since the response was generated or
 * validated *at the origin*, and its presence means the response was not
 * generated for this request. A cached response replays the origin's original
 * `Date` — it is not refreshed on the way out of the cache. The snapshot is
 * served `immutable, max-age=31536000`, so iOS `NSURLSession`'s default
 * `URLCache` will hand back yesterday's copy, `Date` and all. Measuring skew
 * there puts the offset ~24h out, which either freezes every pin at its shipped
 * status or draws yesterday's map. `computeOffset` additionally refuses any
 * response carrying `Age > 0`, so a proxy cache in front of the manifest cannot
 * poison it either.
 *
 * ## 2. What you do with the skew once you have it
 *
 * Apply it. Do not discard on it.
 *
 * A threshold that falls back to the shipped status above some skew abandons
 * precisely the device that needed help — the low-end Android whose clock is
 * three hours out is the one whose derivation is wrong without correction, and
 * "frozen at shipped status" is the same symptom the recompute exists to
 * prevent. The threshold survives only as a guard against a nonsense value.
 */

import type { EventMapItem, ItemStatus } from '../types/eventmap';

/**
 * Beyond this, treat the measurement as nonsense rather than as a real clock
 * error. A day is generous on purpose: a genuinely misconfigured device clock is
 * usually off by hours or by a timezone, and this only needs to exclude values
 * that could not describe a device at all.
 */
export const MAX_PLAUSIBLE_OFFSET_MS = 24 * 60 * 60 * 1000;

/**
 * A stored offset older than this is discarded. The device clock may have been
 * corrected by NTP since it was measured, in which case replaying the old offset
 * would *introduce* the error it exists to remove.
 */
export const OFFSET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** `serverNow − deviceNow`, plus when it was taken so staleness can be judged. */
export interface ClockOffset {
  offsetMs: number;
  measuredAt: number;
}

/**
 * Derive the offset from one manifest response.
 *
 * @param serverDate  the `Date` response header as epoch ms, or null
 * @param age         the `Age` response header in seconds, or null
 * @param deviceNowAtFetch  `Date.now()` captured in the same tick as the response
 *
 * Returns 0 — "trust the device" — whenever there is no usable signal. With no
 * information about server time, the device clock is the best estimate
 * available, and it is right for almost every user.
 */
export function computeOffset(
  serverDate: number | null,
  age: number | null,
  deviceNowAtFetch: number,
): number {
  if (serverDate === null || !Number.isFinite(serverDate)) return 0;
  // Served from a cache: `Date` is the origin's original timestamp, not now.
  if (age !== null && age > 0) return 0;
  const offset = serverDate - deviceNowAtFetch;
  return Math.abs(offset) > MAX_PLAUSIBLE_OFFSET_MS ? 0 : offset;
}

/** Best estimate of the server's current time, in ms. */
export function serverNow(offsetMs: number): number {
  return Date.now() + offsetMs;
}

/** Drop an offset too old to still describe this device's clock. */
export function readUsableOffset(
  stored: ClockOffset | null,
  now: number = Date.now(),
): number {
  if (!stored) return 0;
  if (!Number.isFinite(stored.offsetMs) || !Number.isFinite(stored.measuredAt)) return 0;
  if (Math.abs(stored.offsetMs) > MAX_PLAUSIBLE_OFFSET_MS) return 0;
  if (now - stored.measuredAt > OFFSET_MAX_AGE_MS) return 0;
  return stored.offsetMs;
}

/** ISO instant → epoch ms, or null when absent or unparseable. */
export function parseInstant(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

type StatusInput = Pick<EventMapItem, 'status' | 'startAt' | 'endAt'>;

/**
 * Re-derive an item's status against `now` (server time, i.e. `serverNow()`).
 *
 * Both bounds null means the server is telling us not to recompute — it nulls
 * them for cancelled sessions and for one-sided windows alike. Recomputing
 * anyway would reopen a rain-cancelled bar at its original start time.
 *
 * The window is half-open `[startAt, endAt)`, matching the server, so an item
 * whose `endAt` is exactly `now` reads closed on both sides.
 */
export function deriveItemStatus(item: StatusInput, now: number): ItemStatus {
  const start = parseInstant(item.startAt);
  const end = parseInstant(item.endAt);
  if (start === null && end === null) return item.status;
  if (start !== null && now < start) return 'upcoming';
  if (end !== null && now >= end) return 'closed';
  return 'open';
}

/**
 * The earliest instant strictly after `now` at which some item changes status.
 *
 * The manifest also carries a `nextChangeAt`, but the offline case — the one the
 * snapshot cache exists for — is exactly the case where the manifest fetch
 * failed. With no local boundary there would be no timer, no re-derivation, and
 * the claim that a cached snapshot still tracks live status would be false.
 *
 * Callers arm at the earlier of this and the manifest's value.
 */
export function nextBoundaryAfter(
  items: readonly StatusInput[],
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const item of items) {
    // Skip the "do not recompute" items entirely: their bounds are not
    // boundaries, and the server excludes them from its own nextChangeAt too.
    if (item.startAt === null && item.endAt === null) continue;
    for (const iso of [item.startAt, item.endAt]) {
      const t = parseInstant(iso);
      if (t === null || t <= now) continue;
      if (earliest === null || t < earliest) earliest = t;
    }
  }
  return earliest;
}
