/**
 * What the event list shows, and in what order.
 *
 * Both halves used to be the server's: the snapshot carried its own item set and
 * a `sorts` array declaring which orders were offered. That tier is gone — the
 * markers already carry everything the list needs — so selection is the layer
 * rule below and sorting is the client's own, which is what
 * `docs/reference/map-markers-api.md` means by "sorting is the client's".
 *
 * Pure, and in packages/shared rather than the app: vitest reaches here, while
 * apps/mobile's `node --test` runner does not reach `.tsx`. The ordering rules
 * are exactly the kind of thing that needs a regression test, so they live where
 * one can be written.
 */

import type { AppLanguage } from '../store/settings';
import type { MapLayerDef, RawMarkerData } from '../types/map';
import { isLayerVisible, type LayerVisibilityState } from './chips';
import { pickI18nText } from './text';
import { isOpenNow, nextOpeningAfter } from './window';

export interface VisibleMarkersInput {
  markers: readonly RawMarkerData[];
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
 */
export function selectVisibleMarkers({
  markers,
  layers,
  state,
  now,
}: VisibleMarkersInput): RawMarkerData[] {
  const visible = new Set<string>();
  for (const layer of layers) {
    if (isLayerVisible(layer, state, now)) visible.add(layer.id);
  }
  if (visible.size === 0) return [];
  return markers.filter((m) => visible.has(m.layerId));
}

/**
 * The orders the list offers.
 *
 * The client's own set now. `distance` is absent because it needs
 * expo-location, which is not a dependency — and if it is added, the sort has to
 * be HIDDEN when permission is denied rather than shown as a dead control.
 */
export const PLACE_SORTS = ['order', 'opening', 'title'] as const;
export type PlaceSortKey = (typeof PLACE_SORTS)[number];

/**
 * Rank for the `opening` sort: open now, then by next opening, then never again.
 *
 * An always-open place is open now, so it sorts with the open ones rather than
 * claiming an infinitely-near start. A place with no future window is not
 * "infinitely soon" — it is done, and done belongs at the bottom of a 시작 임박순
 * list rather than the top.
 */
function openingRank(m: RawMarkerData, now: number): number {
  if (isOpenNow(m.hours, now)) return Number.NEGATIVE_INFINITY;
  return nextOpeningAfter(m.hours, now) ?? Number.POSITIVE_INFINITY;
}

/**
 * Sort for the list. Pins are positional and their collisions are the ladder's,
 * so this is the only place a sort is observable.
 *
 * Every comparator falls through to `id`, and that is not tidiness: a tie makes
 * the result depend on input order, and the input is re-derived on every clock
 * boundary — so a tie is a list that reshuffles itself while the user is reading
 * it.
 */
export function sortPlaces(
  markers: readonly RawMarkerData[],
  by: PlaceSortKey,
  lang: AppLanguage,
  now: number,
): RawMarkerData[] {
  const primary =
    by === 'title'
      ? (a: RawMarkerData, b: RawMarkerData) =>
          pickI18nText(a.text, lang).localeCompare(pickI18nText(b.text, lang))
      : by === 'opening'
        ? (a: RawMarkerData, b: RawMarkerData) => {
            // Compared, not subtracted. Both ranks can be infinite — two open
            // places are both -Infinity, two finished ones both +Infinity — and
            // `Infinity - Infinity` is NaN, which is neither 0 nor a sign, so a
            // subtracting comparator would silently skip the id fallthrough and
            // leave the order dependent on input order.
            const ra = openingRank(a, now);
            const rb = openingRank(b, now);
            return ra === rb ? 0 : ra < rb ? -1 : 1;
          }
        : (a: RawMarkerData, b: RawMarkerData) => a.order - b.order;

  return [...markers].sort((a, b) => {
    const rank = primary(a, b);
    if (rank !== 0) return rank;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
