/**
 * Opening hours, derived on the device.
 *
 * The marker wire carries `hours: TimeWindow[]` and deliberately **no
 * `status`**. Status was only ever a cache of the arithmetic below, and caching
 * it forced one both-bounds-null pair to mean two opposite things depending on
 * a sibling field — an always-on 화장실 and a rain-cancelled truck. A
 * cancellation is now expressed by the marker not being served at all, which
 * frees the empty list to mean "always open" and only that.
 *
 * `hours` is an ARRAY because a place is not a day. With one window per
 * document a booth open on both festival days had to be two documents, and the
 * list showed every place twice with nothing on the row to tell them apart.
 *
 * Bounds are absolute instants rather than wall-clock strings, so a device in
 * the wrong TIMEZONE still derives correctly. A device whose CLOCK is genuinely
 * wrong does not, and that is accepted rather than corrected — the same
 * position ADR 0007 takes. The side benefit is the one that matters on the day:
 * the map keeps telling the truth on a dead network.
 *
 * Contract: skkuverse-server `docs/reference/map-markers-api.md` §3.
 */

import type { TimeWindow } from '../types/map';

/** ISO instant → epoch ms, or null when absent or unparseable. */
export function toEpochMs(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Is this one window open at `now`?
 *
 * Half-open `[startAt, endAt)`, matching the server, so a place whose `endAt` is
 * exactly `now` reads closed on both sides. An unparseable bound is treated as
 * absent on that side alone — the parser already drops malformed windows, so
 * this is the belt on a rule the wire is supposed to have kept.
 */
function isWindowOpen(w: TimeWindow, now: number): boolean {
  const start = toEpochMs(w.startAt);
  const end = toEpochMs(w.endAt);
  if (start !== null && now < start) return false;
  if (end !== null && now >= end) return false;
  return true;
}

/**
 * Is this place open right now?
 *
 * The whole rule, and the server states the same one:
 *
 * ```text
 * hours.length === 0 || hours.some(w => now >= w.startAt && now < w.endAt)
 * ```
 *
 * **Empty means always open.** It is not "unknown" and not "closed" — a place
 * with no windows is a 화장실, and the only other thing it could have meant was
 * removed from the wire so this one could be unambiguous.
 */
export function isOpenNow(hours: readonly TimeWindow[], now: number): boolean {
  if (hours.length === 0) return true;
  return hours.some((w) => isWindowOpen(w, now));
}

/**
 * When this place next opens, or `null` if it never will again.
 *
 * Step 3 of the collision ladder — "next opening soonest" — reads this, which is
 * what keeps an overnight map pointed at the stall that opens first rather than
 * at whichever one sorts lower. An always-open place has no next opening: it is
 * already open, so step 1 has answered and this is never consulted for it.
 */
export function nextOpeningAfter(
  hours: readonly TimeWindow[],
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const w of hours) {
    const start = toEpochMs(w.startAt);
    if (start === null || start <= now) continue;
    if (earliest === null || start < earliest) earliest = start;
  }
  return earliest;
}

/**
 * The earliest instant strictly after `now` at which some place opens or closes.
 *
 * Computed locally rather than taken from a server hint, because the offline
 * festival is exactly the case where the hint's request failed — and tracking
 * the clock offline is the whole reason any of this is derived rather than
 * served. There is no manifest left to carry such a hint in any case.
 */
export function nextWindowBoundaryAfter(
  hours: readonly TimeWindow[],
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const w of hours) {
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
