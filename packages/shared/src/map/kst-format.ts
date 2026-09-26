/**
 * An instant as the festival reads it: `10/1(목) 18:00`.
 *
 * Every time the event map shows carries its date. The festival runs on two
 * days, and a bare `18:00 시작` could be either of them.
 *
 * Built from the epoch rather than `Intl`, for three reasons that all bite the
 * old `toLocaleTimeString` path:
 * - **Timezone.** Without `timeZone` the phone's zone formats the instant, so a
 *   visitor with a foreign phone saw a booth open at 05:00. KST is derived the
 *   way `daily-window.ts` derives it, by shifting the epoch and reading UTC.
 * - **Shape.** `ko-KR` renders a month and day as `10. 1.`, not `10/1`.
 * - **Midnight.** `hour12: false` prints `24:00` on some engines; a 주점 closing
 *   at midnight must read `00:00`.
 *
 * Pure, so vitest pins it. The weekday is the only localized part, and it
 * reuses the `day.*` keys the bus schedule already has.
 */

import type { TranslationKey } from '../i18n/translations';
import type { OpeningWindow } from '../types/map';
import { KST_OFFSET_MS } from './daily-window';
import { toEpochMs } from './window';

type Translate = (key: TranslationKey) => string;

/** Indexed by `getUTCDay()`, which counts from Sunday. */
const WEEKDAY_KEYS: readonly TranslationKey[] = [
  'day.sun',
  'day.mon',
  'day.tue',
  'day.wed',
  'day.thu',
  'day.fri',
  'day.sat',
];

/** A `Date` whose UTC fields read as the KST wall clock. Never format it with a local getter. */
function kstFields(epochMs: number): Date {
  return new Date(epochMs + KST_OFFSET_MS);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `"HH:MM"`, 24-hour, KST. Midnight is `00:00`. */
export function formatKstTime(epochMs: number): string {
  const d = kstFields(epochMs);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** `"M/D(요일)"`, KST. */
export function formatKstDate(epochMs: number, t: Translate): string {
  const d = kstFields(epochMs);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${t(WEEKDAY_KEYS[d.getUTCDay()])})`;
}

/** `"M/D(요일) HH:MM"`, KST. */
export function formatKstDateTime(epochMs: number, t: Translate): string {
  return `${formatKstDate(epochMs, t)} ${formatKstTime(epochMs)}`;
}

/**
 * `"M/D(요일) HH:MM–HH:MM"`, `"M/D(요일) HH:MM~"` when the end is unannounced,
 * or `null` for a window that does not parse.
 *
 * The START decides the date, so a 주점 open 18:00–00:00 is dated by the
 * evening it began on rather than the next day its end falls on. An open end is
 * `~` with nothing after it — the way the organisers write it — rather than an
 * invented closing time.
 */
export function formatTimeWindow(w: OpeningWindow, t: Translate): string | null {
  const start = toEpochMs(w.startAt);
  if (start === null) return null;
  if (w.endAt === null) return `${formatKstDateTime(start, t)}~`;
  const end = toEpochMs(w.endAt);
  if (end === null) return null;
  return `${formatKstDateTime(start, t)}–${formatKstTime(end)}`;
}
