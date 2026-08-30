/**
 * The client festival gate, as a pure filter.
 *
 * `/map/config` is fully server-driven: this build draws whatever layers it is
 * handed and has no idea a festival exists. That is the right design — and it
 * is exactly why opening an activation window on the server is, from the app's
 * side, a remote change to what every installed copy renders.
 *
 * This build predates the event map entirely. It has no card templates, no
 * booth list and no `layerId` on a marker, so what a festival actually looks
 * like here is: six unexplained tiles in the filter sheet, and every one of
 * those layers drawing the WHOLE `/map/markers/event` response as captionless
 * dots — `MapMarkerLayer` filters by campus alone, so the same booths are drawn
 * once per layer, stacked. A tap does nothing, because a booth carries no
 * `skkuId`.
 *
 * None of that is worth fixing on this runtime. Closing it is.
 *
 * ## The discriminator
 *
 * `chipGroupId` is `null` for the permanent building layers and set for a
 * festival's, so it splits the served layers along exactly the line that
 * matters. Deliberately not `endpoint === '/map/markers/event'`: `endpoint` is
 * a cache key, so merging or splitting a route for network reasons would move
 * this boundary silently, with no line of code to blame. Keying on the same
 * field the current `dev` build keys on also means the two cannot disagree
 * about what a festival layer is.
 *
 * Pure and store-free, so the decision is unit-tested rather than observed.
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
 * The config with every festival layer removed.
 *
 * Removing the layer DEFINITIONS is what stops the network too: a marker layer
 * only fetches while it is rendered, so a layer the render loop never sees
 * never asks for `/map/markers/event`. There is no second guard to keep in step
 * — and on this runtime there is no second channel at all, since the event map
 * has no endpoint of its own here.
 *
 * Identity-preserving when there is nothing to strip. `mapConfig` is a
 * dependency of `CampusScreen`'s `initFromConfig` effect, so a fresh object on
 * every render would re-seed the layer store on every paint.
 */
export function withoutFestival(config: MapConfig): MapConfig {
  const layers = config.layers.filter((l) => !isFestivalLayer(l));
  if (layers.length === config.layers.length) return config;
  return { ...config, layers };
}
