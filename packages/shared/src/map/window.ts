/**
 * Time-window visibility, derived on the device.
 *
 * The marker wire carries `startAt`/`endAt` and deliberately **no `status`**.
 * Status was only ever a cache of this arithmetic, and caching it forced
 * both-bounds-null to mean two opposite things depending on a sibling field —
 * an always-on 화장실 and a rain-cancelled truck. A cancellation is now
 * expressed by the marker not being served at all, which frees both-null to
 * mean "always visible" and only that.
 *
 * Bounds are absolute instants rather than wall-clock strings, so a device in
 * the wrong TIMEZONE still derives correctly. A device whose CLOCK is genuinely
 * wrong does not, and that is accepted rather than corrected — the same
 * position ADR 0007 takes. The side benefit is the one that matters on the day:
 * the map keeps telling the truth on a dead network.
 */

/** Anything the window rules apply to. Both the marker and the event item fit. */
export interface TimeWindow {
  startAt: string | null;
  endAt: string | null;
}

/** ISO instant → epoch ms, or null when absent or unparseable. */
export function toEpochMs(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Is this window open at `now`?
 *
 * Half-open `[startAt, endAt)`, matching the server, so a thing whose `endAt` is
 * exactly `now` reads closed on both sides. Both bounds null means always.
 */
export function isWithinWindow(w: TimeWindow, now: number): boolean {
  const start = toEpochMs(w.startAt);
  const end = toEpochMs(w.endAt);
  if (start !== null && now < start) return false;
  if (end !== null && now >= end) return false;
  return true;
}

/**
 * The earliest instant strictly after `now` at which some window opens or closes.
 *
 * Computed locally rather than taken from a server hint, because the offline
 * festival is exactly the case where the hint's request failed — and tracking
 * the clock offline is the whole reason any of this is derived rather than
 * served.
 */
export function nextWindowBoundaryAfter(
  windows: readonly TimeWindow[],
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const w of windows) {
    // Both null is not a boundary, it is "always". Scanning it would find
    // nothing anyway; skipping says so.
    if (w.startAt === null && w.endAt === null) continue;
    for (const iso of [w.startAt, w.endAt]) {
      const t = toEpochMs(iso);
      if (t === null || t <= now) continue;
      if (earliest === null || t < earliest) earliest = t;
    }
  }
  return earliest;
}

/**
 * `setTimeout` stores its delay in a signed 32-bit int, so anything past ~24.8
 * days overflows and fires **immediately** — turning a far-future boundary into
 * a re-render hot loop on festival day.
 */
export const MAX_TIMEOUT_MS = 2_147_483_647;
