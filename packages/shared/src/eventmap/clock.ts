/**
 * Status derivation against the device clock.
 *
 * The snapshot is served `immutable, max-age=1y`, so it cannot also carry live
 * status. It ships `status` as of `materializedAt` plus the `startAt`/`endAt`
 * instants, and the device re-derives. Getting that right is the whole feature:
 * a booth that never flips to open at 18:00 is the failure everyone sees.
 *
 * Bounds are absolute instants, never wall-clock strings, so the device's
 * TIMEZONE cannot affect the outcome — a phone set to Bangkok derives exactly
 * what a phone set to Seoul does. What the device's CLOCK says is another
 * matter: a phone whose clock is genuinely wrong derives wrongly, and that is
 * accepted rather than corrected — an earlier design reconciled against the
 * manifest's `Date` header and was removed as more machinery than the rare case
 * justified. The planned mitigation is a warning when the device is not on KST,
 * which catches a misconfigured zone rather than a misconfigured clock.
 */

import type { EventMapItem, ItemStatus } from '../types/eventmap';

/** ISO instant → epoch ms, or null when absent or unparseable. */
export function parseInstant(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

type StatusInput = Pick<EventMapItem, 'status' | 'startAt' | 'endAt'>;

/**
 * Re-derive an item's status against `now` (`Date.now()`).
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
