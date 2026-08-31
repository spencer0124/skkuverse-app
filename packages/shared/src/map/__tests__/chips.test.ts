/**
 * Layer visibility resolution, and the two contract rules a chip tap obeys.
 *
 * The resolution is four tiers and the layer's own schedule is the LAST of them:
 *
 *     forced ?? chipNarrowing ?? userToggle ?? defaultVisibleAt(layer, now)
 *
 * Every tier is a fallback rather than an assignment, which is the property that
 * lets the last one move with the clock: the moment a resolved value is written
 * down, the schedule underneath it is frozen and the user's own choice becomes
 * indistinguishable from the server's suggestion.
 *
 * R1: `layerIds` means "within this group, set exactly these", NOT "turn these
 *     on". Named → on, unnamed sibling in the same group → off, everything
 *     outside the group → untouched. Reading it as "turn these on" is what
 *     would let a chip that jumps to a festival stage leave 주점 lit beside it,
 *     and reading it as "exclusive over everything" is what would turn 건물번호
 *     off underneath.
 *
 * R2: a `userConfigurable: false` layer is never changed by a chip. A chip tap
 *     is a user-initiated change, and that flag already answers who may make
 *     one. Inert today — nothing is false — and tested so it holds when that
 *     quadrant gets its first occupant.
 *
 * The fixture mirrors the live `/map/config`: two building layers outside every
 * group, 주점 scheduled to the evening, 부스 to the day, 편의시설 opt-in, the
 * rest always on.
 */

import { describe, it, expect } from 'vitest';
import type { MapChip, MapChipCamera, MapLayerDef } from '../../types/map';
import {
  defaultVisibleAt,
  isLayerVisible,
  resolveChipLayerVisibility,
  type LayerVisibilityState,
} from '../chips';

const CAMERA: MapChipCamera = {
  lat: 37.295129,
  lng: 126.971234,
  zoom: 17.5,
  tilt: 0,
  bearing: 0,
  durationMs: 500,
};

const layer = (over: Partial<MapLayerDef> & { id: string }): MapLayerDef => ({
  label: over.id,
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/map/overlays/event',
  chipGroupId: 'eskara-2026',
  userConfigurable: true,
  ...over,
});

const LAYERS: MapLayerDef[] = [
  layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/overlays/campus' }),
  layer({ id: 'building_labels', chipGroupId: null, endpoint: '/map/overlays/campus' }),
  layer({ id: 'eskara26_stage' }),
  layer({
    id: 'eskara26_bar',
    defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '18:00', end: '00:00' }] },
  }),
  layer({ id: 'eskara26_food' }),
  layer({
    id: 'eskara26_booth',
    defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '11:00', end: '18:00' }] },
  }),
  layer({ id: 'eskara26_facility', defaultVisibleWhen: { kind: 'never' } }),
  layer({ id: 'eskara26_etc' }),
];

const byId = (id: string) => LAYERS.find((l) => l.id === id)!;

/** The five layers a reset chip is scoped to — everything not `never`. */
const DEFAULT_FESTIVAL_IDS = [
  'eskara26_stage',
  'eskara26_bar',
  'eskara26_food',
  'eskara26_booth',
  'eskara26_etc',
];

const focusChip = (id: string, layerIds: string[], isReset = false): MapChip => ({
  id,
  label: id,
  icon: { kind: 'emoji', emoji: '\u{1F3AA}' },
  action: { kind: 'focus', camera: CAMERA, layerIds },
  isReset,
});

const WEBVIEW_CHIP: MapChip = {
  id: 'lost_found',
  label: 'Lost & Found',
  icon: { kind: 'emoji', emoji: '\u{1F9F3}' },
  action: { kind: 'webview', url: 'https://webview.skkuverse.com/skku/lostandfound' },
  isReset: false,
};

const STAGE_CHIP = focusChip('eskara26_view_stage', ['eskara26_stage']);
const ALL_CHIP = focusChip('eskara-2026_all', DEFAULT_FESTIVAL_IDS, true);

/**
 * Written with an explicit `+09:00` offset rather than a bare local string, so
 * the fixture means one instant whatever machine runs the suite.
 */
const NOON = Date.parse('2026-08-28T12:00:00+09:00');
const DUSK = Date.parse('2026-08-28T19:00:00+09:00');

const state = (
  overrides: Record<string, boolean> = {},
  chip: LayerVisibilityState['chip'] = null,
): LayerVisibilityState => ({ overrides, chip });

describe('defaultVisibleAt — the last tier, and the only one that moves', () => {
  it('reads always and never as themselves, at any hour', () => {
    expect(defaultVisibleAt(byId('eskara26_stage'), NOON)).toBe(true);
    expect(defaultVisibleAt(byId('eskara26_stage'), DUSK)).toBe(true);
    expect(defaultVisibleAt(byId('eskara26_facility'), NOON)).toBe(false);
    expect(defaultVisibleAt(byId('eskara26_facility'), DUSK)).toBe(false);
  });

  it('splits 주점 and 부스 across the day — the whole point of the feature', () => {
    expect(defaultVisibleAt(byId('eskara26_booth'), NOON)).toBe(true);
    expect(defaultVisibleAt(byId('eskara26_bar'), NOON)).toBe(false);

    expect(defaultVisibleAt(byId('eskara26_booth'), DUSK)).toBe(false);
    expect(defaultVisibleAt(byId('eskara26_bar'), DUSK)).toBe(true);
  });

  it('reads an UNREADABLE declaration as off, not as on all day', () => {
    // The direction that matters. `null` is what the parser produces for a kind
    // this build cannot resolve, and reading it as "always" would draw 주점 at
    // noon the first time the server adds a kind — the exact crowding this axis
    // exists to remove. It is deliberately NOT the same as `{ kind: 'never' }`,
    // which is an authoring choice; this is "we could not tell".
    const unreadable = layer({ id: 'future', defaultVisibleWhen: null });
    expect(defaultVisibleAt(unreadable, NOON)).toBe(false);
    expect(defaultVisibleAt(unreadable, DUSK)).toBe(false);
  });

  it('reads a scheduled layer with no windows as off', () => {
    // Unreachable through the parser, which turns it into `null`. Asserted so
    // the belt holds if one is ever constructed by hand: `[].some()` is false,
    // and false is the direction that cannot light a layer nobody scheduled.
    const empty = layer({ id: 'x', defaultVisibleWhen: { kind: 'scheduled', windows: [] } });
    expect(defaultVisibleAt(empty, NOON)).toBe(false);
  });
});

describe('isLayerVisible — four tiers, in order', () => {
  it('falls through to the schedule when the user has said nothing', () => {
    expect(isLayerVisible(byId('eskara26_bar'), state(), NOON)).toBe(false);
    expect(isLayerVisible(byId('eskara26_bar'), state(), DUSK)).toBe(true);
  });

  it('lets the user override the schedule', () => {
    const on = state({ eskara26_bar: true });
    expect(isLayerVisible(byId('eskara26_bar'), on, NOON)).toBe(true);

    const off = state({ eskara26_booth: false });
    expect(isLayerVisible(byId('eskara26_booth'), off, NOON)).toBe(false);
  });

  it('lets a chip narrowing shadow the user override', () => {
    const narrowed = state(
      { eskara26_bar: true },
      { id: 'eskara26_view_stage', visibility: { eskara26_bar: false } },
    );
    expect(isLayerVisible(byId('eskara26_bar'), narrowed, NOON)).toBe(false);
  });

  it('leaves the override intact underneath, so dropping the chip restores it', () => {
    // The reported bug, at the resolution level: the chip SHADOWS, it does not
    // assign. `overrides` is byte-identical either side of the narrowing.
    const overrides = { eskara26_facility: true };
    const narrowed = state(overrides, {
      id: 'eskara26_view_bar',
      visibility: { eskara26_facility: false },
    });
    expect(isLayerVisible(byId('eskara26_facility'), narrowed, DUSK)).toBe(false);
    expect(isLayerVisible(byId('eskara26_facility'), state(overrides), DUSK)).toBe(true);
  });

  it('lets a forced layer outrank even a chip', () => {
    // `userConfigurable: false` puts a layer out of a chip's reach, not only the
    // filter sheet's. Inert today; asserted so it holds when it stops being.
    const locked = layer({ id: 'eskara26_stage', userConfigurable: false });
    const narrowed = state(
      { eskara26_stage: false },
      { id: 'c', visibility: { eskara26_stage: false } },
    );
    expect(isLayerVisible(locked, narrowed, NOON)).toBe(true);
  });

  it('ignores a chip entry for a different layer', () => {
    const narrowed = state({}, { id: 'c', visibility: { eskara26_stage: false } });
    expect(isLayerVisible(byId('eskara26_booth'), narrowed, NOON)).toBe(true);
  });
});

describe('resolveChipLayerVisibility — R1, exactly these within the group', () => {
  it('turns the named layer on and every unnamed sibling off', () => {
    const next = resolveChipLayerVisibility(STAGE_CHIP, LAYERS);
    expect(next).toEqual({
      eskara26_stage: true,
      eskara26_bar: false,
      eskara26_food: false,
      eskara26_booth: false,
      eskara26_facility: false,
      eskara26_etc: false,
    });
  });

  it('leaves a layer outside the group entirely absent from the result', () => {
    const next = resolveChipLayerVisibility(STAGE_CHIP, LAYERS);
    // Absent, not `false`: the write must not so much as mention 건물번호.
    expect(next).not.toHaveProperty('building_numbers');
    expect(next).not.toHaveProperty('building_labels');
  });

  it('turns the opt-in layer on when a chip names it', () => {
    const chip = focusChip('eskara26_view_facility', ['eskara26_facility']);
    expect(resolveChipLayerVisibility(chip, LAYERS)?.eskara26_facility).toBe(true);
  });

  it('returns null for a webview chip', () => {
    expect(resolveChipLayerVisibility(WEBVIEW_CHIP, LAYERS)).toBeNull();
  });

  it('returns null for the camera-only chip, whose layerIds are empty', () => {
    expect(resolveChipLayerVisibility(focusChip('camera_only', []), LAYERS)).toBeNull();
  });

  it('returns null when every named layer is one this build was not served', () => {
    expect(resolveChipLayerVisibility(focusChip('c', ['eskara27_stage']), LAYERS)).toBeNull();
  });

  it('ignores an unserved id but still resolves the group from a served one', () => {
    const chip = focusChip('c', ['eskara27_ghost', 'eskara26_bar']);
    const next = resolveChipLayerVisibility(chip, LAYERS);
    expect(next?.eskara26_bar).toBe(true);
    expect(next).not.toHaveProperty('eskara27_ghost');
  });

  it('refuses to resolve a group off a chipGroupId-null layer', () => {
    // The building layers exist to exercise this: no chip may ever change them,
    // so naming one resolves no group at all rather than an "ungrouped" one.
    expect(resolveChipLayerVisibility(focusChip('c', ['building_numbers']), LAYERS)).toBeNull();
  });
});

describe('resolveChipLayerVisibility — R2, a locked layer is never written', () => {
  it('skips a userConfigurable:false sibling instead of switching it off', () => {
    const locked = LAYERS.map((l) =>
      l.id === 'eskara26_etc' ? { ...l, userConfigurable: false } : l,
    );
    const next = resolveChipLayerVisibility(STAGE_CHIP, locked);
    expect(next).not.toHaveProperty('eskara26_etc');
    expect(next?.eskara26_bar).toBe(false);
  });

  it('skips a userConfigurable:false layer even when the chip names it', () => {
    const locked = LAYERS.map((l) =>
      l.id === 'eskara26_stage' ? { ...l, userConfigurable: false } : l,
    );
    expect(resolveChipLayerVisibility(STAGE_CHIP, locked)).not.toHaveProperty('eskara26_stage');
  });
});

describe('the reset chip is declared, not derived', () => {
  it('carries isReset while an authored narrowing chip does not', () => {
    // What replaced `findNarrowedChip`'s comparison. The reset chip's layerIds
    // used to be recognisable as "the default view"; with a schedule that view
    // depends on the hour, so at 19:00 the comparison stopped answering.
    expect(ALL_CHIP.isReset).toBe(true);
    expect(STAGE_CHIP.isReset).toBe(false);
    expect(WEBVIEW_CHIP.isReset).toBe(false);
  });

  it('names a set that is NOT the default view at every hour', () => {
    // The concrete reason the flag exists. 부스 is in the reset chip's layerIds
    // and is off by default at 19:00, so applying the narrowing rule to a reset
    // tap would turn it on — and 주점 off — which is backwards.
    expect(ALL_CHIP.action.kind === 'focus' && ALL_CHIP.action.layerIds).toContain(
      'eskara26_booth',
    );
    expect(defaultVisibleAt(byId('eskara26_booth'), DUSK)).toBe(false);
  });
});
