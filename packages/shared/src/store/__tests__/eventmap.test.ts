/**
 * Event map chip and sort state.
 *
 * The state and its persistence shipped in Phase 3 and are already exercised by
 * the seeding path; what is new here is the write side. Two rules carry the
 * weight: a single-select group is exclusive and cannot be emptied, and reset
 * restores `defaultSelected` rather than clearing to nothing.
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
    layerVisibility: {},
    selectedChips: {},
    sortId: null,
    selectedStackKey: null,
    clockOffset: null,
  });

describe('useEventMapStore chips and sort', () => {
  beforeEach(() => {
    reset();
    useEventMapStore.getState().initFromSnapshot(SNAPSHOT);
  });

  it('seeds selections from defaultSelected and the first sort', () => {
    const s = useEventMapStore.getState();
    // ESKARA marks only day_all as defaultSelected; every other group starts empty.
    expect(s.selectedChips.day).toEqual(['day_all']);
    expect(s.selectedChips.slot).toEqual([]);
    expect(s.sortId).toBe(SNAPSHOT.sorts[0]?.id);
  });

  it('multi-select toggles in place, both directions', () => {
    const { toggleChip } = useEventMapStore.getState();
    toggleChip('slot', 'slot_night', 'multi');
    toggleChip('slot', 'slot_day', 'multi');
    expect(useEventMapStore.getState().selectedChips.slot).toEqual(['slot_night', 'slot_day']);

    toggleChip('slot', 'slot_night', 'multi');
    expect(useEventMapStore.getState().selectedChips.slot).toEqual(['slot_day']);
  });

  it('multi-select can be emptied — an empty group is a legal "no constraint"', () => {
    const { toggleChip } = useEventMapStore.getState();
    toggleChip('slot', 'slot_day', 'multi');
    toggleChip('slot', 'slot_day', 'multi');
    expect(useEventMapStore.getState().selectedChips.slot).toEqual([]);
  });

  it('single-select replaces rather than accumulating', () => {
    useEventMapStore.getState().toggleChip('day', 'day_2', 'single');
    expect(useEventMapStore.getState().selectedChips.day).toEqual(['day_2']);
  });

  it('single-select refuses to empty itself', () => {
    // Deselecting the active chip has no meaning the config can express — ESKARA
    // spells "no constraint" as an explicit day_all chip — so re-tapping is inert
    // rather than a silent widening to everything.
    const { toggleChip } = useEventMapStore.getState();
    toggleChip('day', 'day_2', 'single');
    toggleChip('day', 'day_2', 'single');
    expect(useEventMapStore.getState().selectedChips.day).toEqual(['day_2']);
  });

  it('clearChips restores defaultSelected, not an empty map', () => {
    const { toggleChip, clearChips } = useEventMapStore.getState();
    toggleChip('day', 'day_2', 'single');
    toggleChip('slot', 'slot_night', 'multi');

    clearChips(SNAPSHOT);
    const s = useEventMapStore.getState();
    expect(s.selectedChips.day).toEqual(['day_all']);
    expect(s.selectedChips.slot).toEqual([]);
  });

  it('setSortId records the chosen sort', () => {
    useEventMapStore.getState().setSortId('soon');
    expect(useEventMapStore.getState().sortId).toBe('soon');
  });

  it('a refetch of the same event does not undo a selection just made', () => {
    const { toggleChip } = useEventMapStore.getState();
    toggleChip('day', 'day_2', 'single');
    toggleChip('slot', 'slot_night', 'multi');

    useEventMapStore.getState().initFromSnapshot(SNAPSHOT);
    const s = useEventMapStore.getState();
    expect(s.selectedChips.day).toEqual(['day_2']);
    expect(s.selectedChips.slot).toEqual(['slot_night']);
    expect(s.sortId).toBe(SNAPSHOT.sorts[0]?.id);
  });

  it('a different layer set starts clean — last year’s chips do not survive', () => {
    useEventMapStore.getState().toggleChip('day', 'day_2', 'single');
    useEventMapStore.getState().setSortId('soon');

    useEventMapStore.getState().initFromSnapshot({ ...SNAPSHOT, id: 'eskara-2027' });
    const s = useEventMapStore.getState();
    expect(s.activeLayerSetId).toBe('eskara-2027');
    expect(s.selectedChips.day).toEqual(['day_all']);
    expect(s.sortId).toBe(SNAPSHOT.sorts[0]?.id);
  });
});
