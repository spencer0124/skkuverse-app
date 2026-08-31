/**
 * The client-side festival gate, as a pure filter.
 *
 * `/map/config` is fully server-driven: the app draws whatever layers and chips
 * it is handed, and it has no idea a festival exists. That is the right design
 * — and it is exactly why an activation window opening on the server is, from
 * the app's side, a remote change to what every installed copy renders. Six
 * layers and six chips appear, the filter sheet grows six tiles,
 * `/map/overlays/event` starts being fetched, and the campus sheet swaps its
 * feed for a booth list.
 *
 * This module is the switch that holds all of that shut until the app decides
 * to open it. The gate is applied once, in `CampusScreen`, which is the sole
 * consumer of the config; `apps/mobile/src/features/map/festivalGate.ts` holds
 * the flag that decides.
 *
 * ## The discriminator
 *
 * No new wire field. `chipGroupId` already splits the served layers exactly
 * along the line that matters, because a chip group is a festival-shaped idea
 * to begin with:
 *
 * | layer                                    | chipGroupId     | endpoint               |
 * | ---------------------------------------- | --------------- | ---------------------- |
 * | `building_numbers`, `building_labels`,   | `null`          | `/map/overlays/campus` |
 * | `campus_geometry`                        |                 |                        |
 * | `eskara26_*`                             | `'eskara-2026'` | `/map/overlays/event`  |
 *
 * `chipGroupId !== null` IS "this is festival content". Deliberately not
 * `endpoint === '/map/overlays/event'`, for the reason `MapLayerDef.chipGroupId`
 * gives at its declaration: `endpoint` is a cache key, so merging or splitting a
 * route for network reasons would silently move the gate's boundary with no line
 * of code to blame.
 *
 * Pure and store-free, the way `chips.ts` and `resolveCampusSuggestion` are —
 * the decision is unit-tested against the bytes production actually served
 * (`__tests__/festival.test.ts`), and no `__DEV__` or `expo-*` import may enter
 * here or the vitest suites stop being able to load it.
 */

import type { MapConfig, MapLayerDef } from '../types/map';

/**
 * Is this layer part of a festival activation?
 *
 * A layer in no chip group is permanent campus furniture; a layer in one exists
 * to be swapped by the chips of an activation that will end.
 */
export function isFestivalLayer(layer: MapLayerDef): boolean {
  return layer.chipGroupId !== null;
}

/**
 * The config with every festival layer and every chip removed.
 *
 * Removing the layer DEFINITIONS is what stops the network too: a layer only
 * fetches while it is rendered (`MapOverlayLayer` mounts per visible layer, and
 * `useLayerOverlays` keys on `layer.endpoint`), so a layer the render loop never
 * sees never asks for `/map/overlays/event`. There is no second guard to keep in
 * step.
 *
 * **Every chip goes, not the subset naming a stripped layer.** Fail closed: a
 * `focus` chip may carry an empty `layerIds` — that is the spelling for
 * camera-only — so a reference-based filter would keep it, and it would fly the
 * camera to an empty festival ground with nothing to show. Every chip the
 * server serves today is festival-scoped, so this costs nothing. The day a
 * permanent chip ships (a webview chip for something that outlives an
 * activation), this rule needs refining rather than reusing.
 *
 * Identity-preserving when there is nothing to strip. `mapConfig` is a
 * dependency of the `initFromConfig` effect and of four memos in
 * `CampusScreen`; a fresh object on every render would re-seed the layer store
 * and re-derive the narrowed chip on every paint.
 */
export function withoutFestival(config: MapConfig): MapConfig {
  const layers = config.layers.filter((l) => !isFestivalLayer(l));
  if (layers.length === config.layers.length && config.chips.length === 0) {
    return config;
  }
  return { ...config, layers, chips: [] };
}
