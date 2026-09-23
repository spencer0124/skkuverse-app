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

import type { MapLayerDef, MapOverlay } from '../types/map';
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
