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

import type { PlaceBlock, PlaceBlockType, PlaceDetail } from '../types/placeDetail';
import type { TimeWindow } from '../types/map';
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

// ── Detail flow ───────────────────────────────────────────────────────────

/**
 * One block below a place's summary.
 *
 * `facts` is the floor — location, hours, links and notices — and it is the
 * only one built from the overlay wire alone, so it is the only one a place
 * without a `PlaceDetail` can still fill. `blocks` is the operator-composed
 * body.
 */
export type PlaceSectionKey = 'facts' | 'blocks';

/**
 * The sections below a place's summary, in display order.
 *
 * **Always starts with `facts`, detail or no detail.** Of the 67 places the
 * server serves, 56 have no detail at all, and every one of them still carries
 * `hours` on the overlay wire — so gating the facts card away was throwing out
 * the opening times of five sixths of the map. `FactsSection` already draws its
 * hours row unconditionally; this is the gate that used to stop it mounting.
 */
export function placeSections(detail: PlaceDetail | null): PlaceSectionKey[] {
  const sections: PlaceSectionKey[] = ['facts'];
  if (detail !== null && detail.blocks.length > 0) sections.push('blocks');
  return sections;
}

// ── Highlight ─────────────────────────────────────────────────────────────

/** Block types the collapsed card can lead with, richest first within a body. */
const HIGHLIGHT_TYPES: readonly PlaceBlockType[] = ['list', 'table'];

/**
 * How many rows of a highlight the collapsed card shows before "외 N개".
 *
 * Per block type rather than per place kind. A list of booth contents reads as
 * chips and three fit on a line; a table row is a full-width name and price, so
 * one is the honest count.
 */
export const HIGHLIGHT_MAX: Readonly<Record<'list' | 'table', number>> = { list: 3, table: 1 };

/**
 * The one block the collapsed sheet lifts above the fold.
 *
 * **The operator chooses it by ordering their blocks**, which is the whole
 * reason this is not a per-kind table any more: a booth that wants its games
 * first and a pub that wants its menu first are the same rule, applied to
 * different bodies. A body of prose alone has nothing to lift, and the
 * collapsed card is its head.
 */
export function highlightBlock(blocks: readonly PlaceBlock[]): PlaceBlock | null {
  return blocks.find((block) => HIGHLIGHT_TYPES.includes(block.type)) ?? null;
}

/** The first image in a body, used as the highlight card's thumbnail. */
export function firstImageUrl(blocks: readonly PlaceBlock[]): string | null {
  const image = blocks.find((block) => block.type === 'image');
  return image === undefined || image.type !== 'image' ? null : image.url;
}
