/**
 * How a place's hours and status read, shared by the list row and the sheet.
 *
 * Lifted out of `PlaceCard` unchanged when the sheet stopped rendering the card:
 * the list row and the sheet's summary must never disagree about whether a
 * place is open, and the one way to guarantee that is one function.
 */

import {
  isOpenNow,
  nextOpeningAfter,
  SdsColors,
  type AppLanguage,
  type PlaceDays,
  type TimeWindow,
  type TranslationKey,
} from '@skkuverse/shared';

export type Openness = 'open' | 'upcoming' | 'closed';

export const STATUS_LABEL: Record<Openness, TranslationKey> = {
  open: 'eventmap.status.open',
  upcoming: 'eventmap.status.upcoming',
  closed: 'eventmap.status.closed',
};

export const STATUS_STYLE: Record<Openness, { color: string; backgroundColor: string }> = {
  open: { color: SdsColors.brand, backgroundColor: SdsColors.grey100 },
  upcoming: { color: SdsColors.grey700, backgroundColor: SdsColors.grey100 },
  closed: { color: SdsColors.grey500, backgroundColor: SdsColors.grey100 },
};

/**
 * Three states out of two functions.
 *
 * The open/closed pill is derived rather than carried, and that is the same
 * decision the wire made when it dropped `status`: it was only ever a cache of
 * `isOpenNow`, and caching it made a place's openness disagree with its own
 * hours the moment the clock passed a boundary.
 *
 * There is no fourth state. `unknown` existed because the server could null
 * both bounds to mean "do not recompute", which is exactly the ambiguity the
 * wire removed: an empty `hours` is ALWAYS OPEN and nothing else, and a
 * cancelled place is not served at all.
 */
export function opennessOf(hours: readonly TimeWindow[], now: number): Openness {
  if (isOpenNow(hours, now)) return 'open';
  return nextOpeningAfter(hours, now) === null ? 'closed' : 'upcoming';
}

const HH_MM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
const M_D: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric' };

/** BCP-47 tags for the app's three languages, for `toLocaleString`. */
const LOCALE: Record<AppLanguage, string> = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN' };

function formatWindow(w: TimeWindow, lang: AppLanguage, withDate: boolean): string {
  const locale = LOCALE[lang];
  const start = new Date(w.startAt);
  const end = new Date(w.endAt);
  const span = `${start.toLocaleTimeString(locale, HH_MM)}–${end.toLocaleTimeString(locale, HH_MM)}`;
  return withDate ? `${start.toLocaleDateString(locale, M_D)} ${span}` : span;
}

/**
 * Opening hours as one line.
 *
 * The server used to ship a formatted `hoursLabel` beside the instants. It does
 * not any more, and that is the right side of the trade: a formatted string
 * cannot follow the device's locale or its 24-hour setting, and the instants
 * were already on the wire for the arithmetic.
 *
 * The date is shown only when there is more than one window, which is exactly
 * when it disambiguates — a 주점 open on both festival nights needs to say which
 * night, a single-window booth does not. A window crossing midnight ends on the
 * next day's date, so `18:00–00:00` reads correctly without a special case.
 */
export function formatHours(hours: readonly TimeWindow[], lang: AppLanguage, always: string): string {
  if (hours.length === 0) return always;
  return hours.map((w) => formatWindow(w, lang, hours.length > 1)).join(', ');
}

/**
 * The summary line's hours: one span, however many days.
 *
 * The summary already says which days in its eyebrow, so repeating a date per
 * window here would spend the line on something it has said. When every window
 * shares one span — the usual festival case, 18:00–00:00 both nights — that
 * span is the line; when they differ, the full list is.
 */
export function formatHoursCompact(hours: readonly TimeWindow[], lang: AppLanguage, always: string): string {
  if (hours.length === 0) return always;
  const [only, ...rest] = new Set(hours.map((w) => formatWindow(w, lang, false)));
  return only !== undefined && rest.length === 0 ? only : formatHours(hours, lang, always);
}

/** One line per window, dated — the info tab's hours rows. */
export function formatHoursLines(hours: readonly TimeWindow[], lang: AppLanguage): string[] {
  return hours.map((w) => formatWindow(w, lang, true));
}

/** `{type:'days', days:[1,3]}` → "1·3일차"; all days → 양일 or 매일. */
export function formatDays(
  days: PlaceDays,
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): string {
  if (days.type === 'all') return t(days.count === 2 ? 'eventmap.day.both' : 'eventmap.day.every');
  return tpl('eventmap.day.nth', days.days.join('·'));
}
