/**
 * Event map client state.
 *
 * Separate from `useMapLayerStore` on purpose — two lifetimes. The campus layer
 * store holds permanent assets; everything here belongs to one event and is
 * meant to be forgotten when the next one arrives. Folding event layer ids into
 * the permanent store would leave dead `eskara-2026` keys in persisted state
 * forever.
 *
 * Note what is NOT here: `basemapOverride`. The snapshot's instruction to hide
 * building numbers during the festival is applied as a DERIVED overlay at render
 * time, never written into this store. A force-then-restore design loses the
 * user's real toggle whenever the app is killed or the activation flips between
 * the write and the restore — leaving 건물번호 off with nothing to point at, and
 * nobody able to find why. Derived, the override simply stops existing when the
 * event does.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EventMapChipGroup, EventMapSnapshot } from '../types/eventmap';
import type { ClockOffset } from '../eventmap/clock';
import { mmkvStateStorage } from './mmkv-storage';

/** Off the wire type rather than a second literal union that could drift. */
type ChipSelection = EventMapChipGroup['selection'];

interface EventMapState {
  /** Which layer set the persisted toggles belong to. */
  activeLayerSetId: string | null;
  /** Layer id → user's explicit choice. Absent means "use the layer's default". */
  layerVisibility: Record<string, boolean>;
  /** Group id → selected chip ids. Composition rules live in `selectMatchingItems`. */
  selectedChips: Record<string, string[]>;
  sortId: string | null;
  /** Which stack's peek sheet is open. Never persisted. */
  selectedStackKey: string | null;
  /**
   * Last measured server-clock offset. Re-measured on every successful manifest
   * fetch, so this only matters on a fully-offline cold start.
   */
  clockOffset: ClockOffset | null;
}

interface EventMapActions {
  initFromSnapshot: (snapshot: EventMapSnapshot) => void;
  toggleLayer: (layerId: string) => void;
  /**
   * `selection` is passed in rather than read from a stored snapshot: the store
   * deliberately holds no copy of the snapshot, so the caller — which already has
   * the group in hand to render it — supplies the one field the semantics need.
   */
  toggleChip: (groupId: string, chipId: string, selection: ChipSelection) => void;
  /** Restore every group to its `defaultSelected` set. Backs the reset button. */
  clearChips: (snapshot: EventMapSnapshot) => void;
  setSortId: (sortId: string) => void;
  setSelectedStackKey: (stackKey: string | null) => void;
  setClockOffset: (offset: ClockOffset) => void;
}

export type EventMapStore = EventMapState & EventMapActions;

const initialState: EventMapState = {
  activeLayerSetId: null,
  layerVisibility: {},
  selectedChips: {},
  sortId: null,
  selectedStackKey: null,
  clockOffset: null,
};

function seedDefaults(snapshot: EventMapSnapshot): {
  layerVisibility: Record<string, boolean>;
  selectedChips: Record<string, string[]>;
  sortId: string | null;
} {
  const layerVisibility: Record<string, boolean> = {};
  for (const layer of snapshot.layers) layerVisibility[layer.id] = layer.defaultVisible;

  return {
    layerVisibility,
    selectedChips: seedChips(snapshot),
    sortId: snapshot.sorts[0]?.id ?? null,
  };
}

function seedChips(snapshot: EventMapSnapshot): Record<string, string[]> {
  const selectedChips: Record<string, string[]> = {};
  for (const group of snapshot.chipGroups) {
    selectedChips[group.id] = group.chips.filter((c) => c.defaultSelected).map((c) => c.id);
  }
  return selectedChips;
}

export const useEventMapStore = create<EventMapStore>()(
  persist(
    (set) => ({
      ...initialState,

      initFromSnapshot: (snapshot) =>
        set((state) => {
          // A different layer set is a different event. Start clean rather than
          // inheriting last year's toggles — and this reset is what bounds the
          // persisted blob to one event's worth of keys.
          if (state.activeLayerSetId !== snapshot.id) {
            return { activeLayerSetId: snapshot.id, ...seedDefaults(snapshot) };
          }

          // Same event: seed only ids not already tracked, so a refetch cannot
          // undo a toggle the user just made. Mirrors useMapLayerStore.
          const layerVisibility = { ...state.layerVisibility };
          for (const layer of snapshot.layers) {
            if (!(layer.id in layerVisibility)) layerVisibility[layer.id] = layer.defaultVisible;
          }
          const selectedChips = { ...state.selectedChips };
          for (const group of snapshot.chipGroups) {
            if (!(group.id in selectedChips)) {
              selectedChips[group.id] = group.chips
                .filter((c) => c.defaultSelected)
                .map((c) => c.id);
            }
          }
          return {
            layerVisibility,
            selectedChips,
            sortId: state.sortId ?? snapshot.sorts[0]?.id ?? null,
          };
        }),

      toggleLayer: (layerId) =>
        set((state) => ({
          layerVisibility: {
            ...state.layerVisibility,
            [layerId]: !(state.layerVisibility[layerId] ?? true),
          },
        })),

      toggleChip: (groupId, chipId, selection) =>
        set((state) => {
          const current = state.selectedChips[groupId] ?? [];
          if (selection === 'single') {
            // Replace, and refuse to empty. A single-select group is an exclusive
            // axis, and ESKARA spells its "no constraint" case as an explicit
            // `day_all` chip — so deselecting the active one has no meaning the
            // config can express, and tapping it again is a no-op rather than a
            // silent widening.
            return current[0] === chipId
              ? state
              : { selectedChips: { ...state.selectedChips, [groupId]: [chipId] } };
          }
          const next = current.includes(chipId)
            ? current.filter((id) => id !== chipId)
            : [...current, chipId];
          return { selectedChips: { ...state.selectedChips, [groupId]: next } };
        }),

      clearChips: (snapshot) => set({ selectedChips: seedChips(snapshot) }),

      setSortId: (sortId) => set({ sortId }),

      setSelectedStackKey: (stackKey) => set({ selectedStackKey: stackKey }),

      setClockOffset: (offset) => set({ clockOffset: offset }),
    }),
    {
      name: 'eventmap',
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      // selectedStackKey is excluded deliberately: a peek sheet reopening on
      // cold start, for a booth the user tapped yesterday, is never right.
      partialize: (state) => ({
        activeLayerSetId: state.activeLayerSetId,
        layerVisibility: state.layerVisibility,
        selectedChips: state.selectedChips,
        sortId: state.sortId,
        clockOffset: state.clockOffset,
      }),
    },
  ),
);
