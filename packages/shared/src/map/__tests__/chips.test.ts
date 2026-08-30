/**
 * Map chips — the two contract rules a chip tap must obey.
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
 * group, five default-visible festival layers and one opt-in (편의시설).
 */

import { describe, it, expect } from 'vitest';
import type { MapChip, MapChipCamera, MapLayerDef } from '../../types/map';
import {
  findNarrowedChip,
  isChipGroupAtDefaults,
  isLayerVisible,
  resolveChipGroupDefaults,
  resolveChipLayerVisibility,
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
  type: 'marker',
  label: over.id,
  defaultVisible: true,
  endpoint: '/map/markers/event',
  chipGroupId: 'eskara-2026',
  userConfigurable: true,
  ...over,
});

const LAYERS: MapLayerDef[] = [
  layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/markers/campus' }),
  layer({ id: 'building_labels', chipGroupId: null, endpoint: '/map/markers/campus' }),
  layer({ id: 'eskara26_stage' }),
  layer({ id: 'eskara26_bar' }),
  layer({ id: 'eskara26_food' }),
  layer({ id: 'eskara26_booth' }),
  layer({ id: 'eskara26_facility', defaultVisible: false }),
  layer({ id: 'eskara26_etc' }),
];

/** The five default-visible festival layers — what the reset chip (26ESKARA) restores. */
const DEFAULT_FESTIVAL_IDS = [
  'eskara26_stage',
  'eskara26_bar',
  'eskara26_food',
  'eskara26_booth',
  'eskara26_etc',
];

const focusChip = (id: string, layerIds: string[]): MapChip => ({
  id,
  label: id,
  icon: { kind: 'emoji', emoji: '\u{1F3AA}' },
  action: { kind: 'focus', camera: CAMERA, layerIds },
});

const WEBVIEW_CHIP: MapChip = {
  id: 'lost_found',
  label: 'Lost & Found',
  icon: { kind: 'emoji', emoji: '\u{1F9F3}' },
  action: { kind: 'webview', url: 'https://webview.skkuverse.com/skku/lostandfound' },
};

const STAGE_CHIP = focusChip('eskara26_view_stage', ['eskara26_stage']);
const ALL_CHIP = focusChip('eskara-2026_all', DEFAULT_FESTIVAL_IDS);

/**
 * Store shape: an entry per layer the config seeded.
 *
 * Takes the layer list rather than closing over `LAYERS`, because a test adding
 * a second chip group has to seed its layers too — otherwise they fall back to
 * their own `defaultVisible` and the group silently reads as untouched.
 */
const statesOf = (
  defs: readonly MapLayerDef[],
  visibleIds: string[],
): Record<string, { visible: boolean }> =>
  Object.fromEntries(defs.map((l) => [l.id, { visible: visibleIds.includes(l.id) }]));

const states = (visibleIds: string[]) => statesOf(LAYERS, visibleIds);

describe('isLayerVisible — the one resolution expression', () => {
  it('prefers a tracked state over the default', () => {
    const l = layer({ id: 'x', defaultVisible: true });
    expect(isLayerVisible(l, { x: { visible: false } })).toBe(false);
  });

  it('falls back to defaultVisible for an untracked layer', () => {
    expect(isLayerVisible(layer({ id: 'x', defaultVisible: true }), {})).toBe(true);
    expect(isLayerVisible(layer({ id: 'x', defaultVisible: false }), {})).toBe(false);
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

  it('restores the five default-visible layers for the reset chip, not all six', () => {
    const next = resolveChipLayerVisibility(ALL_CHIP, LAYERS);
    expect(next?.eskara26_facility).toBe(false);
    for (const id of DEFAULT_FESTIVAL_IDS) expect(next?.[id]).toBe(true);
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

describe('findNarrowedChip — the view the map has been narrowed to', () => {
  const CHIPS = [WEBVIEW_CHIP, ALL_CHIP, STAGE_CHIP];

  it('names the chip whose group state matches exactly', () => {
    expect(findNarrowedChip(CHIPS, LAYERS, states(['eskara26_stage']))?.id).toBe(
      'eskara26_view_stage',
    );
  });

  it('names nothing when the group sits at its defaults', () => {
    // The reset chip DOES match here, and matching is not the question: sitting
    // at what the server ships is not something the user did, so there is
    // nothing to name and nothing to clear.
    expect(findNarrowedChip(CHIPS, LAYERS, states(DEFAULT_FESTIVAL_IDS))).toBeNull();
  });

  it('names nothing once a layer is toggled outside any chip view', () => {
    const drifted = states(['eskara26_stage', 'eskara26_bar']);
    expect(findNarrowedChip(CHIPS, LAYERS, drifted)).toBeNull();
  });

  it('never names a webview chip', () => {
    expect(findNarrowedChip([WEBVIEW_CHIP], LAYERS, states([]))).toBeNull();
  });

  it('ignores a layer outside the group when matching', () => {
    // 건물번호 off is the user's business and must not stop 공연 being named.
    const withBuildingsOff = states(['eskara26_stage']);
    withBuildingsOff.building_numbers = { visible: false };
    expect(findNarrowedChip(CHIPS, LAYERS, withBuildingsOff)?.id).toBe('eskara26_view_stage');
  });

  it('keeps searching past an at-defaults match in another group', () => {
    // The failure this rule exists for. With a second chip group, the reset
    // chip of group A matches on every launch — returning it and testing
    // at-defaults afterwards would suppress the strip for a genuinely narrowed
    // group B, leaving the user no name for the view and no way back.
    const poiLayers: MapLayerDef[] = [
      ...LAYERS,
      layer({ id: 'poi_cafe', chipGroupId: 'poi', endpoint: '/map/markers/poi' }),
      layer({ id: 'poi_atm', chipGroupId: 'poi', endpoint: '/map/markers/poi' }),
    ];
    const poiChip = focusChip('poi_view_cafe', ['poi_cafe']);
    // The festival group at its defaults, the POI group narrowed to one chip.
    const poiStates = statesOf(poiLayers, [...DEFAULT_FESTIVAL_IDS, 'poi_cafe']);

    expect(findNarrowedChip([ALL_CHIP, poiChip], poiLayers, poiStates)?.id).toBe(
      'poi_view_cafe',
    );
  });
});

describe('chip group defaults — what the clear control restores', () => {
  it('restores each layer in the group to its own defaultVisible', () => {
    expect(resolveChipGroupDefaults(STAGE_CHIP, LAYERS)).toEqual({
      eskara26_stage: true,
      eskara26_bar: true,
      eskara26_food: true,
      eskara26_booth: true,
      eskara26_facility: false,
      eskara26_etc: true,
    });
  });

  it('reports a narrowed group as not at its defaults', () => {
    expect(isChipGroupAtDefaults(STAGE_CHIP, LAYERS, states(['eskara26_stage']))).toBe(false);
  });

  it('reports the default view as at its defaults', () => {
    expect(isChipGroupAtDefaults(ALL_CHIP, LAYERS, states(DEFAULT_FESTIVAL_IDS))).toBe(true);
  });

  it('returns null for a chip that resolves no group', () => {
    expect(resolveChipGroupDefaults(WEBVIEW_CHIP, LAYERS)).toBeNull();
  });
});
