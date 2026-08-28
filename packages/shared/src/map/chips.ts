/**
 * The rules a map chip tap obeys, as pure functions.
 *
 * A layer answers *what is drawn*. A chip answers *where should I be looking,
 * and what should be on while I look there*. Two rules govern what a tap may
 * change, and both are the server's (`map-markers-api.md` §8.2) rather than
 * this file's invention:
 *
 *  1. **Only layers sharing the `chipGroupId` of the layers the chip names.**
 *     The chip's `layerIds` resolve to one group; every layer in that group is
 *     set (named → on, unnamed sibling → off) and every layer outside it is
 *     untouched. That is what lets a festival chip swap the six festival layers
 *     while 건물번호 and 건물이름 stay exactly as the user left them. Neither
 *     "exclusive over everything" nor "purely additive" does that: the first
 *     turns the baseline off, the second cannot give a clean single-purpose
 *     view.
 *  2. **Never a `userConfigurable: false` layer.** A chip tap is a
 *     user-initiated change, and that flag already answers who may make one.
 *     Inert today, since nothing is `false`.
 *
 * Pure and store-free on purpose, the way `resolveCampusSuggestion` is: the
 * decision is unit-tested against the real layer shapes, and the screen is left
 * holding nothing but the write.
 */

import type { MapChip, MapLayerDef } from '../types/map';

/** The minimum a caller must know about a layer's current state. */
export type LayerVisibilityStates = Readonly<Record<string, { visible: boolean }>>;

/**
 * Is this layer drawn right now: the user's toggle, or the layer's own default.
 *
 * One function rather than the expression, which used to be written out at
 * three call sites — `CampusScreen`'s render loop, its filter badge and
 * `FilterSheet`'s tiles. They drifted once already: the sheet read
 * `states[id]?.visible` alone and showed 건물번호 ON while the map was hiding
 * it. Chips are the fourth reader, and a fourth copy is how that happens again.
 */
export function isLayerVisible(
  layer: MapLayerDef,
  states: LayerVisibilityStates,
): boolean {
  return states[layer.id]?.visible ?? layer.defaultVisible;
}

/**
 * The group a chip's tap is scoped to, or `null` when it is scoped to nothing.
 *
 * Read off the first named layer that this build was actually served AND that
 * carries a non-null `chipGroupId`. Both conditions matter and fail
 * differently: an id the config does not serve is a chip pointing at a layer
 * outside its activation window, while a `null` group is a real layer that no
 * chip may ever change (the building layers). Either way the chip keeps its
 * camera and changes no visibility.
 */
function resolveGroup(
  chip: MapChip,
  layers: readonly MapLayerDef[],
): string | null {
  if (chip.action.kind !== 'focus') return null;
  for (const id of chip.action.layerIds) {
    const group = layers.find((l) => l.id === id)?.chipGroupId;
    if (group) return group;
  }
  return null;
}

/**
 * Every layer a chip's group covers and that a chip is allowed to change.
 *
 * Rule 2 lives here alone, so no caller can forget it.
 */
function writableGroupLayers(
  group: string,
  layers: readonly MapLayerDef[],
): MapLayerDef[] {
  return layers.filter(
    (l) => l.chipGroupId === group && l.userConfigurable !== false,
  );
}

/**
 * What a chip tap sets, or `null` when it sets nothing.
 *
 * `null` covers three cases that are all "move the camera and leave the layers
 * alone": a webview chip, the camera-only chip whose `layerIds` are empty, and
 * a chip whose named layers resolve no group. The caller does not need to tell
 * them apart.
 *
 * Note what is NOT in the returned record: a layer outside the group is absent
 * rather than present-and-false. The write must not so much as mention it.
 */
export function resolveChipLayerVisibility(
  chip: MapChip,
  layers: readonly MapLayerDef[],
): Record<string, boolean> | null {
  const group = resolveGroup(chip, layers);
  if (group === null || chip.action.kind !== 'focus') return null;
  const named = new Set(chip.action.layerIds);
  const next: Record<string, boolean> = {};
  for (const layer of writableGroupLayers(group, layers)) {
    next[layer.id] = named.has(layer.id);
  }
  return next;
}

/**
 * The chip the map has been NARROWED to, or `null`.
 *
 * Derived rather than stored, so there is no second source of truth to drift:
 * a layer toggled in the filter sheet stops any chip describing the map, and
 * the answer survives a remount because it was never state. Server order
 * decides ties, since the server is what ordered the row.
 *
 * Two conditions, and the second is easy to mistake for a caller's concern. A
 * chip whose group sits at the visibility the server declared has narrowed
 * nothing — the reset chip matches exactly that on every launch — so it is
 * skipped and the search CONTINUES. Testing it after the loop instead would
 * work while there is one chip group and break the day there is a second: the
 * reset chip of group A would be returned first and suppress the answer for a
 * genuinely narrowed group B, leaving the user no name for the view and no way
 * back.
 */
export function findNarrowedChip(
  chips: readonly MapChip[],
  layers: readonly MapLayerDef[],
  states: LayerVisibilityStates,
): MapChip | null {
  for (const chip of chips) {
    const target = resolveChipLayerVisibility(chip, layers);
    if (!target) continue;
    const matches = layers.every(
      (layer) =>
        !(layer.id in target) || isLayerVisible(layer, states) === target[layer.id],
    );
    if (!matches) continue;
    if (isChipGroupAtDefaults(chip, layers, states)) continue;
    return chip;
  }
  return null;
}

/**
 * The chip's group restored to what the server declared, or `null`.
 *
 * What the clear control writes. Derived from each layer's own `defaultVisible`
 * rather than from any chip's `layerIds`, so it stays correct for a group whose
 * reset chip was never served — and so 편의시설, which ships hidden, goes back
 * to hidden rather than to whatever a chip happened to name.
 */
export function resolveChipGroupDefaults(
  chip: MapChip,
  layers: readonly MapLayerDef[],
): Record<string, boolean> | null {
  const group = resolveGroup(chip, layers);
  if (group === null) return null;
  const next: Record<string, boolean> = {};
  for (const layer of writableGroupLayers(group, layers)) {
    next[layer.id] = layer.defaultVisible;
  }
  return next;
}

/**
 * Is this chip's group sitting at the visibility the server declared?
 *
 * Drives whether a clear control is offered at all: there is nothing to clear
 * when nothing has been narrowed. The same rule the filter badge already uses,
 * where a layer hidden by the server's own default does not count as the user
 * having narrowed anything.
 */
export function isChipGroupAtDefaults(
  chip: MapChip,
  layers: readonly MapLayerDef[],
  states: LayerVisibilityStates,
): boolean {
  const defaults = resolveChipGroupDefaults(chip, layers);
  if (!defaults) return true;
  return layers.every(
    (layer) =>
      !(layer.id in defaults) || isLayerVisible(layer, states) === defaults[layer.id],
  );
}
