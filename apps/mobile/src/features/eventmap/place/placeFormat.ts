/**
 * How a place's hours and status read, shared by the list row and the sheet.
 *
 * Lifted out of `PlaceCard` unchanged when the sheet stopped rendering the card:
 * the list row and the sheet's summary must never disagree about whether a
 * place is open, and the one way to guarantee that is one function.
 */

import {
  currentOpenRun,
  formatKstDateTime,
  formatTimeWindow,
  isOpenNow,
  nextOpeningAfter,
  pickI18nText,
  SdsColors,
  type AppLanguage,
  type OpeningWindow,
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
export function opennessOf(hours: readonly OpeningWindow[], now: number): Openness {
  if (isOpenNow(hours, now)) return 'open';
  return nextOpeningAfter(hours, now) === null ? 'closed' : 'upcoming';
}

/**
 * Opening hours as one line — the list row's.
 *
 * The server used to ship a formatted `hoursLabel` beside the instants. It does
 * not any more, and that is the right side of the trade: a formatted string
 * cannot follow the app's language, and the instants were already on the wire
 * for the arithmetic.
 *
 * Every window is dated, even a place's only one. The festival runs on two
 * days, so `18:00–23:00` alone leaves the visitor guessing which of them — the
 * date is the half of the answer the time cannot give.
 */
export function formatHours(
  hours: readonly OpeningWindow[],
  t: (key: TranslationKey) => string,
  lang: AppLanguage,
  always: string,
): string {
  if (hours.length === 0) return always;
  return formatHoursLines(hours, t, lang).join(', ');
}

/**
 * One dated line per window — the sheet's hours row. A window that does not
 * parse is skipped. A labelled window leads with its label (`단체 입장 · …`), so
 * a place that runs differently across its windows says which is which.
 */
export function formatHoursLines(
  hours: readonly OpeningWindow[],
  t: (key: TranslationKey) => string,
  lang: AppLanguage,
): string[] {
  return hours.flatMap((w) => {
    const time = formatTimeWindow(w, t);
    if (time === null) return [];
    return w.label ? `${pickI18nText(w.label, lang)} · ${time}` : time;
  });
}

/**
 * The one status sentence the sheet needs above its actions. It intentionally
 * answers only the immediate question — whether to go now, and when that
 * answer changes — while the full timetable remains in Details.
 *
 * The moment it names is dated like every other time on the map: `18:00 시작`
 * at 02:00 between the two nights would not say which evening.
 */
export function statusLineOf(
  hours: readonly OpeningWindow[],
  now: number,
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): { text: string; color: string } {
  if (hours.length === 0) return { text: t('eventmap.hours.always'), color: SdsColors.brand };

  // The RUN, not the window: touching windows are one stretch of being open.
  const run = currentOpenRun(hours, now);
  if (run) {
    return {
      text:
        run.until === null
          ? t('eventmap.status.openNoEnd')
          : tpl('eventmap.status.openUntil', formatKstDateTime(run.until, t)),
      color: SdsColors.brand,
    };
  }

  const next = nextOpeningAfter(hours, now);
  if (next !== null) {
    return {
      text: tpl('eventmap.status.opensAt', formatKstDateTime(next, t)),
      color: SdsColors.grey700,
    };
  }
  return { text: t('eventmap.status.closed'), color: SdsColors.grey500 };
}
