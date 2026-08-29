/**
 * Event map sort state and its persistence.
 *
 * The store holds one per-event choice, the sort, keyed to the layer set it was
 * made for. Two rules carry the weight: a refetch of the same event must not
 * undo a sort the user just picked, and a different event must not inherit
 * last year's. The persisted blob is schema-versioned, and the migration is
 * tested directly because the keys it drops are exactly the ones an old install
 * would otherwise rehydrate as stray properties.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEventMapStore } from '../eventmap';
import type { EventMapSnapshot } from '../../types/eventmap';
import snapshotFixture from '../../eventmap/__tests__/fixtures/eskara-snapshot.json';

// Native module — importing it in Node fails outright. vitest hoists vi.mock
// above the imports, so declaring it here still applies before evaluation.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

const SNAPSHOT = snapshotFixture as unknown as EventMapSnapshot;

const reset = () =>
  useEventMapStore.setState({
    activeLayerSetId: null,
    sortId: null,
    selectedStackKey: null,
  });

describe('useEventMapStore sort', () => {
  beforeEach(() => {
    reset();
    useEventMapStore.getState().initFromSnapshot(SNAPSHOT);
  });

  it("seeds the sort from the snapshot's first entry", () => {
    const s = useEventMapStore.getState();
    expect(s.activeLayerSetId).toBe(SNAPSHOT.id);
    expect(s.sortId).toBe(SNAPSHOT.sorts[0]?.id);
  });

  it('setSortId records the chosen sort', () => {
    useEventMapStore.getState().setSortId('soon');
    expect(useEventMapStore.getState().sortId).toBe('soon');
  });

  it('a refetch of the same event does not undo a sort just chosen', () => {
    useEventMapStore.getState().setSortId('soon');
    useEventMapStore.getState().initFromSnapshot(SNAPSHOT);
    expect(useEventMapStore.getState().sortId).toBe('soon');
  });

  it("a different layer set starts clean — last year's sort does not survive", () => {
    useEventMapStore.getState().setSortId('soon');
    useEventMapStore.getState().initFromSnapshot({ ...SNAPSHOT, id: 'eskara-2027' });
    const s = useEventMapStore.getState();
    expect(s.activeLayerSetId).toBe('eskara-2027');
    expect(s.sortId).toBe(SNAPSHOT.sorts[0]?.id);
  });
});

describe('useEventMapStore persistence', () => {
  it('persists the sort and its layer set, never the open sheet', () => {
    const { partialize } = useEventMapStore.persist.getOptions();
    const state = { ...useEventMapStore.getState(), activeLayerSetId: 'e', sortId: 'soon' };
    expect(partialize!({ ...state, selectedStackKey: 'k' })).toEqual({
      activeLayerSetId: 'e',
      sortId: 'soon',
    });
  });

  it('migrates a v2 blob by dropping the keys the snapshot no longer carries', async () => {
    // persist shallow-merges the stored blob over the initial state, so a key
    // that merely stopped being written would come back on every launch.
    const { migrate, version } = useEventMapStore.persist.getOptions();
    expect(version).toBe(3);
    const v2 = {
      activeLayerSetId: 'eskara-2026',
      layerVisibility: { bar: true },
      selectedChips: { day: ['day_all'] },
      sortId: 'soon',
      clockOffset: 12,
    };
    expect(await migrate!(v2, 2)).toEqual({ activeLayerSetId: 'eskara-2026', sortId: 'soon' });
  });
});
