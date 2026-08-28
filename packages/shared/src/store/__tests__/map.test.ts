/**
 * Map layer visibility state.
 *
 * `setLayersVisible` is the chip write, and it carries one rule the sheet's
 * `toggleLayer` also carries: only an id the config already seeded may be
 * written. A chip can name a layer this build was not served — a festival chip
 * outlives its activation window on purpose — and minting an entry for it would
 * leave a record nothing renders, which then shadows the real layer's
 * `defaultVisible` the day the server starts serving one.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMapLayerStore } from '../map';
import type { MapLayerDef } from '../../types/map';

// Native module — importing it in Node fails outright. The settings store this
// one seeds `selectedCampus` from reaches MMKV at module load.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

const layer = (id: string, defaultVisible: boolean): MapLayerDef => ({
  id,
  type: 'marker',
  label: id,
  defaultVisible,
  endpoint: '/map/markers/eskara26',
  chipGroupId: 'eskara26',
  userConfigurable: true,
});

const DEFS = [
  layer('eskara26_stage', true),
  layer('eskara26_bar', true),
  layer('eskara26_facility', false),
];

const visibility = () =>
  Object.fromEntries(
    Object.entries(useMapLayerStore.getState().layers).map(([id, s]) => [id, s.visible]),
  );

beforeEach(() => {
  useMapLayerStore.setState({ layers: {} });
  useMapLayerStore.getState().initFromConfig(DEFS);
});

describe('setLayersVisible — the chip write', () => {
  it('applies every id in one commit', () => {
    useMapLayerStore.getState().setLayersVisible({
      eskara26_stage: true,
      eskara26_bar: false,
      eskara26_facility: false,
    });
    expect(visibility()).toEqual({
      eskara26_stage: true,
      eskara26_bar: false,
      eskara26_facility: false,
    });
  });

  it('ignores an id the config never seeded rather than minting one', () => {
    useMapLayerStore.getState().setLayersVisible({ eskara27_stage: true });
    expect(useMapLayerStore.getState().layers).not.toHaveProperty('eskara27_stage');
  });

  it('leaves a layer it was not asked about alone', () => {
    useMapLayerStore.getState().setLayersVisible({ eskara26_stage: false });
    expect(visibility().eskara26_bar).toBe(true);
  });

  it('preserves the load status alongside the visibility', () => {
    useMapLayerStore.getState().setLayerStatus('eskara26_stage', 'loaded');
    useMapLayerStore.getState().setLayersVisible({ eskara26_stage: false });
    expect(useMapLayerStore.getState().layers.eskara26_stage).toEqual({
      visible: false,
      status: 'loaded',
    });
  });
});

describe('initFromConfig — a re-fetch must not undo a toggle', () => {
  it('seeds only ids it is not already tracking', () => {
    useMapLayerStore.getState().setLayersVisible({ eskara26_stage: false });
    useMapLayerStore.getState().initFromConfig(DEFS);
    expect(visibility().eskara26_stage).toBe(false);
  });

  it('seeds a layer that appears mid-session at its own default', () => {
    useMapLayerStore.getState().initFromConfig([...DEFS, layer('eskara26_food', true)]);
    expect(visibility().eskara26_food).toBe(true);
  });
});
