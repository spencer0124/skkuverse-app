/**
 * The decisions behind a festival place's sheet, as pure functions.
 *
 * The sheet has one skeleton for every kind of place — a summary on top, then
 * tabs — and what varies by kind is only which blocks are non-empty. Those
 * choices live here rather than in the components so they can be pinned by
 * vitest: which festival day a booth belongs to, which tabs a place earns, and
 * what the collapsed sheet shows as its highlight.
 *
 * Pure and store-free, like `festival.ts`: no `__DEV__` or `expo-*` import may
 * enter here, or the vitest suites stop being able to load it.
 */

import type {
  PlaceContent,
  PlaceDetail,
  PlaceEntryFee,
  PlaceKind,
  PlaceMenuItem,
} from '../types/placeDetail';
import type { I18nText, TimeWindow } from '../types/map';
import { toEpochMs } from './window';

// ── Festival days ─────────────────────────────────────────────────────────

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * `YYYY-MM-DD` of the KST calendar day an instant falls on.
 *
 * From the epoch, never from `Date.getDate()`, for the reason
 * `daily-window.ts` gives: a phone set to another zone must still put a booth
 * on the right festival day.
 */
export function kstDateKey(epochMs: number): string {
  return new Date(epochMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Every KST day any served place opens on, ascending.
 *
 * Derived rather than configured: the server deliberately carries no festival
 * calendar, and the places' own hours already say which days exist. A window's
 * START decides its day, so a 주점 open 18:00–00:00 belongs to the evening it
 * began on rather than to the next date its end carries.
 */
export function festivalDaysOf(places: readonly { hours: readonly TimeWindow[] }[]): string[] {
  const days = new Set<string>();
  for (const place of places) {
    for (const w of place.hours) {
      const start = toEpochMs(w.startAt);
      if (start !== null) days.add(kstDateKey(start));
    }
  }
  return [...days].sort();
}

/** Which festival days a place is open on. */
export type PlaceDays =
  /** Every day of the festival. `count` picks between 양일 and 매일. */
  | { type: 'all'; count: number }
  /** 1-based day numbers, ascending. */
  | { type: 'days'; days: number[] };

/**
 * The day label for one place, or `null` when there is nothing worth saying.
 *
 * Null for a one-day festival (every place is on "day 1", which is noise), for
 * an always-open place (empty hours), and for a place whose windows fall on no
 * known day — which only a stale `days` list can produce.
 */
export function dayLabelOf(hours: readonly TimeWindow[], days: readonly string[]): PlaceDays | null {
  if (days.length < 2 || hours.length === 0) return null;
  const own = new Set<number>();
  for (const w of hours) {
    const start = toEpochMs(w.startAt);
    if (start === null) continue;
    const index = days.indexOf(kstDateKey(start));
    if (index >= 0) own.add(index + 1);
  }
  if (own.size === 0) return null;
  if (own.size === days.length) return { type: 'all', count: days.length };
  return { type: 'days', days: [...own].sort((a, b) => a - b) };
}

// ── Tabs ──────────────────────────────────────────────────────────────────

export type PlaceTabKey = 'home' | 'menu' | 'info';
/**
 * `prose` is the server's own `content` actions — text the overlay wire already
 * carries (a 리워드 안내, say). It is not part of `PlaceDetail`, so it is counted
 * separately and lands in the home tab whether or not a detail exists.
 */
export type PlaceSectionKey = 'intro' | 'contents' | 'notices' | 'prose' | 'menu' | 'info';

export interface PlaceTab {
  key: PlaceTabKey;
  sections: PlaceSectionKey[];
}

function hasMenu(detail: PlaceDetail): boolean {
  return detail.entryFees.length > 0 || detail.menu.some((g) => g.items.length > 0);
}

/**
 * Whether the info tab would say anything the summary does not.
 *
 * The summary already carries one line of hours and the location, so an info
 * tab holding only those repeats it. What earns the tab is a row the summary
 * lacks: the organisation, a link, payment methods, or a second day's hours.
 */
function hasInfo(detail: PlaceDetail, hours: readonly TimeWindow[]): boolean {
  return (
    detail.org !== null ||
    detail.instagramUrl !== null ||
    detail.paymentMethods.length > 0 ||
    hours.length > 1
  );
}

/**
 * The tabs below a place's summary, in display order, empty ones dropped.
 *
 * The caller decides what the count means: two or more is a tab bar, one is its
 * sections drawn without a bar, none is a sheet that ends at the summary. A
 * place with no detail at all — a toilet, or anything the server has not been
 * given more for — is the last case, which is how the base skeleton and the
 * server-only state share one code path. The one thing a detail-less place can
 * still have below its summary is the server's prose (`proseCount`), which
 * makes a single home tab.
 */
export function buildPlaceTabs(
  detail: PlaceDetail | null,
  hours: readonly TimeWindow[],
  proseCount = 0,
): PlaceTab[] {
  const prose: PlaceSectionKey[] = proseCount > 0 ? ['prose'] : [];
  if (detail === null) return prose.length > 0 ? [{ key: 'home', sections: prose }] : [];

  const home: PlaceSectionKey[] = [];
  if (detail.intro !== null || detail.logoUrl !== null) home.push('intro');
  if (detail.contents.length > 0) home.push('contents');
  if (detail.notices.length > 0) home.push('notices');
  home.push(...prose);

  const tabs: PlaceTab[] = [];
  if (home.length > 0) tabs.push({ key: 'home', sections: home });
  if (hasMenu(detail)) tabs.push({ key: 'menu', sections: ['menu'] });
  if (hasInfo(detail, hours)) tabs.push({ key: 'info', sections: ['info'] });
  return tabs;
}

// ── Highlight ─────────────────────────────────────────────────────────────

export interface PriceRange {
  min: number;
  max: number;
}

/**
 * The one block the collapsed sheet adds beyond name, organisation and hours.
 *
 * This is the answer to "show more while collapsed": a festival visitor
 * deciding where to walk wants to know what a place serves or runs, and that
 * fits in two or three lines.
 */
export type PlaceHighlight =
  | { type: 'menu'; items: PlaceMenuItem[]; more: number; entryFee: PriceRange | null }
  | { type: 'contents'; items: PlaceContent[]; more: number }
  | { type: 'text'; text: I18nText };

type HighlightSource = 'menu' | 'contents' | 'intro' | 'notice';

/** What each kind leads with, in fallback order. */
const HIGHLIGHT_ORDER: Record<PlaceKind, readonly HighlightSource[]> = {
  pub: ['menu', 'contents', 'intro', 'notice'],
  foodTruck: ['menu', 'intro', 'notice'],
  goods: ['menu', 'notice', 'intro'],
  booth: ['contents', 'intro', 'notice'],
  promo: ['contents', 'intro', 'notice'],
  facility: ['notice', 'intro'],
  stage: ['contents', 'intro', 'notice'],
  etc: ['contents', 'intro', 'notice'],
};

/** How many lines a list highlight may take before it says "외 N개". */
const HIGHLIGHT_LIMIT: Record<PlaceKind, number> = {
  pub: 2,
  foodTruck: 2,
  goods: 2,
  booth: 2,
  promo: 1,
  facility: 1,
  stage: 2,
  etc: 2,
};

export function entryFeeRange(fees: readonly PlaceEntryFee[]): PriceRange | null {
  if (fees.length === 0) return null;
  const prices = fees.map((f) => f.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function highlightOf(detail: PlaceDetail | null): PlaceHighlight | null {
  if (detail === null) return null;
  const limit = HIGHLIGHT_LIMIT[detail.kind];

  for (const source of HIGHLIGHT_ORDER[detail.kind]) {
    switch (source) {
      case 'menu': {
        if (!hasMenu(detail)) break;
        const all = detail.menu.flatMap((g) => g.items);
        return {
          type: 'menu',
          items: all.slice(0, limit),
          more: Math.max(0, all.length - limit),
          entryFee: entryFeeRange(detail.entryFees),
        };
      }
      case 'contents': {
        if (detail.contents.length === 0) break;
        return {
          type: 'contents',
          items: detail.contents.slice(0, limit),
          more: Math.max(0, detail.contents.length - limit),
        };
      }
      case 'intro': {
        if (detail.intro === null) break;
        return { type: 'text', text: detail.intro };
      }
      case 'notice': {
        const first = detail.notices[0];
        if (first === undefined) break;
        return { type: 'text', text: first };
      }
    }
  }
  return null;
}

// ── Prices ────────────────────────────────────────────────────────────────

/**
 * `12000` → `"12,000"`.
 *
 * By hand rather than `toLocaleString`, so the output does not depend on which
 * ICU data the JS engine was built with — the separator is the same comma in
 * all three of the app's languages.
 */
export function groupThousands(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `{min: 16000, max: 20000}` → `"16,000–20,000"`; a flat range → one number. */
export function formatPriceRange(range: PriceRange): string {
  return range.min === range.max
    ? groupThousands(range.min)
    : `${groupThousands(range.min)}–${groupThousands(range.max)}`;
}
