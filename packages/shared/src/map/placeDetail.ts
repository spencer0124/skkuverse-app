/**
 * The decisions behind a festival place's sheet, as pure functions.
 *
 * The sheet has one skeleton for every kind of place — a summary on top, then
 * tabs — and what varies by kind is only which blocks are non-empty. Those
 * choices live here rather than in the components so they can be pinned by
 * vitest: which sections a place earns and what the collapsed sheet shows as
 * its highlight.
 *
 * Pure and store-free, like `festival.ts`: no `__DEV__` or `expo-*` import may
 * enter here, or the vitest suites stop being able to load it.
 */

import type { PlaceBlock, PlaceBlockType, PlaceDetail } from '../types/placeDetail';
import type { I18nText, MapOverlay } from '../types/map';

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
 * **Always starts with `facts`, detail or no detail.** Most places the server
 * serves have no detail at all, and every one of them still carries `hours` on
 * the overlay wire — so gating the facts card away was throwing out the opening
 * times of most of the map. `FactsSection` already draws its
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

// ── Photos ────────────────────────────────────────────────────────────────

/** One photo of a gallery, as the rail and the full-screen viewer draw it. */
export interface PlaceImage {
  id: string;
  url: string;
  caption: I18nText | null;
}

/**
 * One item of a body as the sheet draws it: a block, or a run of photos.
 *
 * `id` is the first image's, so it stays stable as long as the run's head does.
 */
export type PlaceBodyItem =
  | { type: 'block'; id: string; block: PlaceBlock }
  | { type: 'gallery'; id: string; images: PlaceImage[] };

/**
 * The body with each run of CONSECUTIVE image blocks folded into one gallery.
 *
 * A food truck is a menu table followed by one photo per dish. Drawn a block at
 * a time, three photos were three rails of one image each, stacked, and the
 * viewer opened each alone. Folded, they are one rail the viewer pages across.
 * Only adjacency folds: an image the operator put between two paragraphs is a
 * gallery of one, and stays where they put it.
 */
export function placeBody(blocks: readonly PlaceBlock[]): PlaceBodyItem[] {
  const items: PlaceBodyItem[] = [];
  for (const block of blocks) {
    if (block.type !== 'image') {
      items.push({ type: 'block', id: block.id, block });
      continue;
    }
    const image: PlaceImage = { id: block.id, url: block.url, caption: block.caption };
    const last = items[items.length - 1];
    if (last?.type === 'gallery') last.images.push(image);
    else items.push({ type: 'gallery', id: block.id, images: [image] });
  }
  return items;
}

/**
 * The gallery the summary lifts under its highlight — the body's first.
 *
 * The body skips it by `id`, so a photo is never drawn twice in one sheet.
 */
export function heroGallery(body: readonly PlaceBodyItem[]): Extract<PlaceBodyItem, { type: 'gallery' }> | null {
  for (const item of body) if (item.type === 'gallery') return item;
  return null;
}

/**
 * Whether a place's sheet opens at its tallest detent rather than its lowest.
 *
 * The low detent exists to keep the place's pin in view above the sheet. A pin
 * that names only an AREA — the festival's food trucks, placed on the day and
 * stacked on one point — has nothing to show there, so the low detent is only a
 * step the user would have to drag past. The server says which pins those are
 * (`locationAccuracy`); what follows from it is decided here, once.
 *
 * Only a marker can be `area`. A zone is an area by construction and keeps the
 * low detent, which shows the zone itself.
 */
export function placeSheetOpensTall(place: MapOverlay | null): boolean {
  return place?.kind === 'marker' && place.locationAccuracy === 'area';
}
