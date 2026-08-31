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
import { isDailyWindowOpen, kstMinutesOfDay } from './daily-window';

/**
 * The minimum a caller must know about layer state.
 *
 * Two records rather than one, and the split is the whole design. `overrides`
 * holds ONLY what the user expressed, so an absent id means "no opinion" and the
 * schedule below answers — which is what lets a default vary with the clock at
 * all. `chip` is a transient narrowing laid over the top, so dropping it
 * restores the user's own choices rather than the server's defaults.
 */
export interface LayerVisibilityState {
  overrides: Readonly<Record<string, boolean>>;
  chip: Readonly<{
    id: string;
    visibility: Readonly<Record<string, boolean>>;
  }> | null;
}

/**
 * When this layer is on, absent anything the user or a chip said.
 *
 * `null` — an unreadable declaration — is OFF. That is the fail-closed
 * direction, and it is the opposite of what this parser does for
 * `userConfigurable`, deliberately: see `parseDefaultVisibleWhen`, which carries
 * the argument. Short version: this axis exists to put less on screen, so
 * reading a rule we cannot understand as "on all day" contradicts the intent it
 * was trying to state.
 *
 * `scheduled` is evaluated against the KST minute derived from the epoch, so the
 * device's timezone setting never enters it.
 */
export function defaultVisibleAt(layer: MapLayerDef, now: number): boolean {
  const when = layer.defaultVisibleWhen;
  if (when === null) return false;
  switch (when.kind) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'scheduled': {
      const minutes = kstMinutesOfDay(now);
      return when.windows.some((w) => isDailyWindowOpen(w, minutes));
    }
  }
}

/**
 * Is this layer drawn right now?
 *
 * Four tiers, and the layer's own schedule is the last resort:
 *
 * ```text
 * forced ?? chipNarrowing ?? userToggle ?? defaultVisibleAt(layer, now)
 * ```
 *
 * Every tier is a FALLBACK, never an assignment. Writing any of them into the
 * store would destroy a preference the user cannot re-express — and, now that
 * the last tier moves with the clock, would freeze a schedule the moment it was
 * first read. That is exactly the bug this replaced: the store used to be seeded
 * from the server's default, after which nothing could tell a value the user
 * chose from one the server suggested.
 *
 * `forced` is the `userConfigurable: false` case. It outranks a chip because
 * such a layer is out of a chip's reach too, not only the filter sheet's. Inert
 * today, since nothing ships `false`.
 *
 * One function rather than the expression, which used to be written out at
 * three call sites — `CampusScreen`'s render loop, a filter-button badge it no
 * longer has, and `FilterSheet`'s tiles. They drifted once already: the sheet
 * read `states[id]?.visible` alone and showed 건물번호 ON while the map was
 * hiding it. The chips and the event list read it too now, and another copy
 * is how that happens again.
 */
export function isLayerVisible(
  layer: MapLayerDef,
  state: LayerVisibilityState,
  now: number,
): boolean {
  if (layer.userConfigurable === false) return defaultVisibleAt(layer, now);
  const narrowed = state.chip?.visibility[layer.id];
  if (narrowed !== undefined) return narrowed;
  const own = state.overrides[layer.id];
  if (own !== undefined) return own;
  return defaultVisibleAt(layer, now);
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

/*
 * `findNarrowedChip`, `resolveChipGroupDefaults` and `isChipGroupAtDefaults`
 * lived here and are gone.
 *
 * All three derived the narrowed chip, and the way back out of it, from the
 * layers' CURRENT visibility. That worked while the way back was "the server's
 * defaults", and it cannot work now for two independent reasons. The clear
 * control has to restore what the USER had, and a past is not recoverable from
 * a present — the chip's own write is what overwrote it. And the reset chip
 * stopped being recognisable by comparing what it names against the default
 * view, because with `defaultVisibleWhen` that view depends on the time of day.
 *
 * So the narrowing is stored (`LayerVisibilityState.chip`) and the reset chip is
 * declared (`MapChip.isReset`). Both facts now come from somewhere that cannot
 * be wrong about them.
 */
