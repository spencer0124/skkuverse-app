/**
 * Event map client state — the two choices the marker payload cannot carry.
 *
 * Separate from `useMapLayerStore` on purpose: that one is ephemeral, seeded
 * from `/map/config` on every launch, and it is where an event layer's
 * visibility lives — festival layers are ordinary served layers. What is left
 * here is the list's sort and which place has a sheet open.
 *
 * The sort used to be chosen from a `sorts` array the snapshot declared, and was
 * keyed to the layer set that declared it. There is no snapshot and no such
 * array now — the orders are the client's own (`map/list.ts`) — so the key is
 * the chip group, which is the layer set id by another name and is the one thing
 * on `/map/config` that changes when next year's festival replaces this one.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PLACE_SORTS, type PlaceSortKey } from '../map/list';
import { mmkvStateStorage } from './mmkv-storage';

const DEFAULT_SORT: PlaceSortKey = PLACE_SORTS[0];

interface EventMapState {
  /** The chip group the persisted sort was chosen for. */
  activeLayerSetId: string | null;
  sortId: PlaceSortKey;
  /**
   * Which place's peek sheet is open. Never persisted.
   *
   * A place id, not a stack key. Stacks existed because several sessions
   * collapsed onto one plot and a tap could not say which was meant; a place is
   * one document now and `tap.placeId` is its own id, so two booths sharing a
   * spot are two taps rather than one sheet listing both.
   */
  selectedPlaceId: string | null;
}

interface EventMapActions {
  /** Reset the sort when the live layer set changes. Same seeding rule as useMapLayerStore. */
  syncLayerSet: (layerSetId: string | null) => void;
  setSortId: (sortId: PlaceSortKey) => void;
  setSelectedPlaceId: (placeId: string | null) => void;
}

export type EventMapStore = EventMapState & EventMapActions;

const initialState: EventMapState = {
  activeLayerSetId: null,
  sortId: DEFAULT_SORT,
  selectedPlaceId: null,
};

export const useEventMapStore = create<EventMapStore>()(
  persist(
    (set) => ({
      ...initialState,

      syncLayerSet: (layerSetId) =>
        set((state) => {
          if (layerSetId === null || state.activeLayerSetId === layerSetId) return state;
          // A different layer set is a different event. Start clean rather than
          // inheriting last year's sort.
          return { activeLayerSetId: layerSetId, sortId: DEFAULT_SORT };
        }),

      setSortId: (sortId) => set({ sortId }),

      setSelectedPlaceId: (placeId) => set({ selectedPlaceId: placeId }),
    }),
    {
      name: 'eventmap',
      // Every bump has left a key behind: v2 dropped `clockOffset`, v3 dropped
      // `layerVisibility` and `selectedChips`, and v4 drops `selectedStackKey`
      // along with the whole snapshot tier that produced stacks. persist
      // shallow-merges the stored blob over the initial state, so without a
      // migration an existing install would reintroduce each as a stray property
      // the types no longer describe.
      version: 4,
      migrate: (persisted) => {
        if (persisted && typeof persisted === 'object') {
          const blob = persisted as Record<string, unknown>;
          delete blob.clockOffset;
          delete blob.layerVisibility;
          delete blob.selectedChips;
          delete blob.selectedStackKey;
          // A v3 `sortId` is a SERVER sort id ('manual', 'distance', …), not one
          // of this build's keys. Dropping it lets the default apply rather than
          // leaving the list on an order nothing can render.
          if (!PLACE_SORTS.includes(blob.sortId as PlaceSortKey)) delete blob.sortId;
        }
        return persisted as EventMapStore;
      },
      storage: createJSONStorage(() => mmkvStateStorage),
      // selectedPlaceId is excluded deliberately: a peek sheet reopening on cold
      // start, for a booth the user tapped yesterday, is never right.
      partialize: (state) => ({
        activeLayerSetId: state.activeLayerSetId,
        sortId: state.sortId,
      }),
    },
  ),
);
