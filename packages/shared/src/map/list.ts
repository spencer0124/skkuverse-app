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

/** The option held per facet id; `null` is "전체" on an optional facet. */
export type FacetSelection = Readonly<Record<string, string | null>>;

/**
 * Where a list opens: each `required` facet on the option whose window
 * contains `now`, else its first; each `optional` facet on nothing.
 *
 * Before the festival that is 1일차 and after it the first again — the list
 * a person planning ahead or looking back most likely wants.
 */
export function defaultFacetSelection(list: MapChipList, now: number): FacetSelection {
  const out: Record<string, string | null> = {};
  for (const facet of list.facets) {
    if (facet.select === 'optional') {
      out[facet.id] = null;
      continue;
    }
    const current = facet.options.find(
      ({ window }) => window !== null && now >= Date.parse(window.startAt) && now < Date.parse(window.endAt),
    );
    out[facet.id] = (current ?? facet.options[0])?.id ?? null;
  }
  return out;
}

/**
 * The places in every selected option. A facet with nothing selected filters
 * nothing, and a place the server put in no option of a selected facet is left
 * out — that is the server's answer, not a gap to fill here.
 */
export function filterByFacets(
  places: readonly MapOverlay[],
  list: MapChipList,
  selection: FacetSelection,
): MapOverlay[] {
  const active = list.facets.flatMap((facet) => {
    const option = selection[facet.id];
    return option ? [[facet.id, option] as const] : [];
  });
  if (active.length === 0) return [...places];
  return places.filter((place) =>
    active.every(([facetId, option]) => place.facets[facetId]?.includes(option) ?? false),
  );
}

/**
 * The list's order, then `id` — the same tiebreak as `sortPlaces`, for the same
 * reason: a tie would reshuffle rows on every clock boundary.
 *
 *  - `order`: the place's order within the selected option of `scopeFacetId`
 *    (a booth's running order that day), else its `order`.
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
  const option = scope ? selection[scope] : null;
  const keyOf = (p: MapOverlay) => (option ? (p.orderByOption[option] ?? p.order) : p.order);
  return [...places].sort((a, b) => keyOf(a) - keyOf(b) || byId(a, b));
}
