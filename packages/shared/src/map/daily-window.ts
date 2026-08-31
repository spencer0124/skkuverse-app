/**
 * The wall-clock engine: a window that recurs every day at the same KST hour.
 *
 * Separate from `window.ts`, whose bounds are absolute instants and whose
 * docblock says so. The two axes are not interchangeable and the split is the
 * point: a place's `hours` describe one booth on one festival day, while a
 * layer's `defaultVisibleWhen` says "주점 belongs to the evening", which is the
 * same sentence on every day of every festival.
 *
 * **The KST minute is derived from the epoch, never from the device's local
 * hour.** `Date.now()` is UTC epoch milliseconds and a device's zone setting
 * only changes how a time is *formatted*, so a phone set to New York still flips
 * 주점 on at 18:00 KST. Reaching for `Date.getHours()` here would look simpler
 * and would break exactly the case ADR 0007 promises to survive — a device in
 * the wrong timezone still derives correctly, and only a genuinely wrong *clock*
 * does not.
 *
 * The fixed +09:00 is exact rather than an approximation: Korea has had no DST
 * since 1988. If this app ever serves a campus outside Korea, this constant is
 * the bug, and the layer set config's `timezone` field is where the real answer
 * would come from.
 */

import type { DailyWindow } from '../types/map';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * MS_PER_MINUTE;

/** Milliseconds elapsed since the most recent KST midnight. */
function msIntoKstDay(now: number): number {
  // Double modulo so the function is total: a negative `now` (a fake clock in a
  // test, a device set before 1970) still lands in [0, MS_PER_DAY).
  return (((now + KST_OFFSET_MS) % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
}

/** Minutes since KST midnight, 0–1439. */
export function kstMinutesOfDay(now: number): number {
  return Math.floor(msIntoKstDay(now) / MS_PER_MINUTE);
}

/**
 * `"HH:MM"` 24-hour → minutes since midnight, or `null`.
 *
 * Anchored, and deliberately strict about the shape: `"7:00"` and `"24:00"` are
 * both rejected. The server rejects them too, so one spelling of an hour and one
 * spelling of midnight (`"00:00"`) reach this side.
 */
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutesOfDay(hhmm: string): number | null {
  const m = HHMM_RE.exec(hhmm);
  if (m === null) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Is this window open at `minutes` past KST midnight?
 *
 * Half-open `[start, end)`, matching the marker side, so a window ending exactly
 * now reads closed. **`start > end` wraps past midnight**, which is the whole
 * reason a bar's `18:00`–`00:00` needs no special case: at 23:59 the first arm
 * answers, and 00:00 itself is closed because `0 < 0` is false.
 *
 * An unparseable bound reads closed. The parser already dropped malformed
 * entries, so this is the belt on a rule the wire is supposed to have kept —
 * and closed is the direction that cannot turn an unreadable rule into a layer
 * drawn all day.
 */
export function isDailyWindowOpen(w: DailyWindow, minutes: number): boolean {
  const start = toMinutesOfDay(w.start);
  const end = toMinutesOfDay(w.end);
  if (start === null || end === null) return false;
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

/**
 * The next instant any of these windows opens or closes, or `null`.
 *
 * What a timer is armed at. Every boundary is a minute-of-day, so each one is
 * placed on today's KST calendar and pushed to tomorrow when it has already
 * passed — which is what makes a daily window's next edge an absolute instant
 * the caller can subtract `now` from.
 *
 * **Never returns a value at or before `now`.** A zero delay fires immediately,
 * re-arms at the same boundary and spins — the same trap `nextWindowBoundaryAfter`
 * guards on the marker side.
 */
export function nextDailyBoundaryAfter(
  windows: readonly DailyWindow[],
  now: number,
): number | null {
  const midnight = now - msIntoKstDay(now);
  let best: number | null = null;
  for (const w of windows) {
    for (const bound of [w.start, w.end]) {
      const minutes = toMinutesOfDay(bound);
      if (minutes === null) continue;
      let at = midnight + minutes * MS_PER_MINUTE;
      if (at <= now) at += MS_PER_DAY;
      if (best === null || at < best) best = at;
    }
  }
  return best;
}
