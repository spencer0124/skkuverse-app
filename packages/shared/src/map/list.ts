/**
 * What the event list shows, and in what order.
 *
 * Both halves used to be the server's: the snapshot carried its own item set and
 * a `sorts` array declaring which orders were offered. That tier is gone — the
 * markers already carry everything the list needs — so selection is the layer
 * rule below and the order is the author's `order`, applied here, which is what
 * `docs/reference/map-markers-api.md` means by "sorting is the client's".
 *
 * Pure, and in packages/shared rather than the app: vitest reaches here, while
 * apps/mobile's `node --test` runner does not reach `.tsx`. The ordering rules
 * are exactly the kind of thing that needs a regression test, so they live where
 * one can be written.
 */

import type { MapChipList, MapLayerDef, MapOverlay } from '../types/map';
import { isLayerVisible, type LayerVisibilityState } from './chips';

export interface VisibleOverlaysInput {
  markers: readonly MapOverlay[];
  /** The `/map/config` layers this build was served. */
  layers: readonly MapLayerDef[];
  /** The map layer store's user overrides and active chip narrowing. */
  state: LayerVisibilityState;
  /**
   * The clock a layer's schedule is read against. The SAME number the render
   * loop used, passed rather than taken from `Date.now()` here: a list computed
   * a millisecond the other side of 18:00 would disagree with the pins beside
   * it, which is precisely the mismatch this function exists to prevent.
   */
  now: number;
}

/**
 * The markers whose layer is drawn right now, in the order they were given.
 *
 * One rule, and it is the map's rule rather than a second one: a place is listed
 * exactly when its layer is drawn. Both come down to `isLayerVisible` over the
 * same `/map/config` layer — the render loop, the filter sheet's tiles and the
 * chips already read it, so the list cannot show 주점 while the map hides it.
 *
 * **A place suppressed by a coordinate collision still gets a row.** The pin
 * ladder answers "which of these do we draw here"; it does not answer "does this
 * place exist", and a booth that loses its spot to a bar at 19:00 is still open
 * and still worth listing. That asymmetry is the whole reason the two live in
 * different modules.
 *
 * A marker naming a layer this build was not served is not listed. There is no
 * pin for it either — the marker route serves per served layer — so the two stay
 * in step for an id outside the activation window too.
 *
 * An inert overlay (`tap: null`) is not listed either. A row is a way to a
 * place, and a background zone or a label-only overlay has nowhere to go —
 * listing it would open an all-but-empty sheet.
 */
export function selectVisibleOverlays({
  markers,
  layers,
  state,
  now,
}: VisibleOverlaysInput): MapOverlay[] {
  const visible = new Set<string>();
  for (const layer of layers) {
    if (isLayerVisible(layer, state, now)) visible.add(layer.id);
  }
  if (visible.size === 0) return [];
  return markers.filter((m) => m.tap !== null && visible.has(m.layerId));
}

/**
 * The list's order: the author's `order`, ascending.
 *
 * Falls through to `id`, and that is not tidiness: a tie makes the result depend
 * on input order, and the input is re-derived on every clock boundary — so a tie
 * is a list that reshuffles itself while the user is reading it.
 */
export function sortPlaces(markers: readonly MapOverlay[]): MapOverlay[] {
  return [...markers].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ── A chip's list: facets and sort ──
//
// The server decides everything here — which options exist, which places are
// in each, how a list sorts (`MapChip.list`, `MapOverlay.facets`). What is left
// is id matching and one comparator, so the rules below are deliberately
// mechanical: the app never derives a day from a date.

/**
 * The options held per facet id. A `required` facet holds exactly one; an
 * `optional` one holds any non-empty subset, and holding all of them is "no
 * filter" — which is what it opens on.
 */
export type FacetSelection = Readonly<Record<string, readonly string[]>>;

/**
 * Where a list opens.
 *
 *  - A checklist (`optional`, 운영) on 전체: every option checked.
 *  - A single choice (`required`, 일자) on the option that is on NOW, else the
 *    nearest one still to come, else the last. So before the festival it is
 *    the first day, it flips at the second day's cut-over, and after the
 *    festival it stays on the last day. A facet with no windows opens on its
 *    first option.
 */
export function defaultFacetSelection(list: MapChipList, now: number): FacetSelection {
  const out: Record<string, readonly string[]> = {};
  for (const facet of list.facets) {
    if (facet.select === 'optional') {
      out[facet.id] = facet.options.map((o) => o.id);
      continue;
    }
    const timed = facet.options.flatMap((option) =>
      option.window
        ? [{ id: option.id, start: Date.parse(option.window.startAt), end: Date.parse(option.window.endAt) }]
        : [],
    );
    const current = timed.find((o) => now >= o.start && now < o.end);
    const next = [...timed].filter((o) => o.start > now).sort((a, b) => a.start - b.start)[0];
    const last = [...timed].sort((a, b) => b.end - a.end)[0];
    const pick = (current ?? next ?? last)?.id ?? facet.options[0]?.id;
    out[facet.id] = pick ? [pick] : [];
  }
  return out;
}

/** True when a facet's selection holds every option — no filter at all. */
export function isWholeFacet(facet: MapChipList['facets'][number], held: readonly string[] | undefined): boolean {
  return held !== undefined && facet.options.every((o) => held.includes(o.id));
}

/**
 * A checklist facet's next state after a tap on `optionId`, or on 전체 when
 * `null`. Every option held is 전체.
 *
 *  - 전체 tapped: every option.
 *  - An option tapped under 전체: that option alone — one tap to narrow.
 *  - Otherwise it toggles; emptied, it falls back to 전체, so "nothing
 *    selected" never exists and no tap has to be refused.
 *
 * Kept in the server's option order whatever order the taps came in.
 */
export function toggleChecklist(
  facet: MapChipList['facets'][number],
  held: readonly string[],
  optionId: string | null,
): readonly string[] {
  const all = facet.options.map((o) => o.id);
  if (optionId === null) return all;
  if (isWholeFacet(facet, held)) return [optionId];
  const toggled = held.includes(optionId) ? held.filter((id) => id !== optionId) : [...held, optionId];
  return toggled.length === 0 ? all : all.filter((id) => toggled.includes(id));
}

/**
 * Whether a facet is narrowing the list — anything but 전체 — which the filter
 * row shows as engaged. A single choice has no 전체, so it always is.
 */
export function isFacetNarrowed(facet: MapChipList['facets'][number], held: readonly string[]): boolean {
  return facet.select === 'required' || !isWholeFacet(facet, held);
}

/**
 * The places in the selection. A place passes a facet when it is in ANY of
 * the options held there. A facet holding every option filters nothing — so a
 * booth with no 운영 tag still shows until someone narrows 운영 — and so does
 * a facet with nothing held, which the UI never produces.
 */
export function filterByFacets(
  places: readonly MapOverlay[],
  list: MapChipList,
  selection: FacetSelection,
): MapOverlay[] {
  const active = list.facets.flatMap((facet) => {
    const held = selection[facet.id];
    if (!held || held.length === 0 || isWholeFacet(facet, held)) return [];
    return [[facet.id, held] as const];
  });
  if (active.length === 0) return [...places];
  return places.filter((place) =>
    active.every(([facetId, held]) => (place.facets[facetId] ?? []).some((o) => held.includes(o))),
  );
}

/**
 * The list's order, then `id` — the same tiebreak as `sortPlaces`, for the same
 * reason: a tie would reshuffle rows on every clock boundary.
 *
 *  - `order` scoped to a facet: by the first checked option of that facet the
 *    place is in, then by its `orderByOption` there, else its `order` — a
 *    booth's running order per day. Unscoped: just `order`.
 *  - `title`: the Korean title in code-point order. Hangul syllables are
 *    encoded in 가나다 order, so this needs no `Intl` — and no collator that
 *    Hermes might build differently on one platform.
 */
export function sortForList(
  places: readonly MapOverlay[],
  list: MapChipList,
  selection: FacetSelection,
): MapOverlay[] {
  const byId = (a: MapOverlay, b: MapOverlay) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (list.sort.key === 'title') {
    return [...places].sort((a, b) =>
      a.text.ko !== b.text.ko ? (a.text.ko < b.text.ko ? -1 : 1) : byId(a, b),
    );
  }
  const scope = list.sort.scopeFacetId;
  const held = scope ? (selection[scope] ?? []) : [];
  if (!scope || held.length === 0) {
    return [...places].sort((a, b) => a.order - b.order || byId(a, b));
  }
  // By the first checked option the place is in, then its order within it: one
  // day checked is that day's running order; both are day 1's order, then the
  // places that open only on day 2 in day 2's order.
  const rankOf = (p: MapOverlay): [number, number] => {
    const mine = p.facets[scope] ?? [];
    const at = held.findIndex((o) => mine.includes(o));
    if (at < 0) return [held.length, p.order];
    return [at, p.orderByOption[held[at]!] ?? p.order];
  };
  return [...places].sort((a, b) => {
    const [ga, oa] = rankOf(a);
    const [gb, ob] = rankOf(b);
    return ga - gb || oa - ob || byId(a, b);
  });
}
