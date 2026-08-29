/**
 * Event map client state.
 *
 * Separate from `useMapLayerStore` on purpose — two lifetimes. The campus layer
 * store is ephemeral, seeded from `/map/config` on every launch, and that is
 * where an event layer's visibility lives now, festival layers included: they
 * are ordinary served layers. What is left here is the one per-event choice
 * worth keeping across launches, the sort, keyed to the layer set it was made
 * for so next year's event does not inherit it.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EventMapSnapshot } from '../types/eventmap';
import { mmkvStateStorage } from './mmkv-storage';

interface EventMapState {
  /** Which layer set the persisted sort belongs to. */
  activeLayerSetId: string | null;
  sortId: string | null;
  /** Which stack's peek sheet is open. Never persisted. */
  selectedStackKey: string | null;
}

interface EventMapActions {
  initFromSnapshot: (snapshot: EventMapSnapshot) => void;
  setSortId: (sortId: string) => void;
  setSelectedStackKey: (stackKey: string | null) => void;
}

export type EventMapStore = EventMapState & EventMapActions;

const initialState: EventMapState = {
  activeLayerSetId: null,
  sortId: null,
  selectedStackKey: null,
};

export const useEventMapStore = create<EventMapStore>()(
  persist(
    (set) => ({
      ...initialState,

      initFromSnapshot: (snapshot) =>
        set((state) => {
          // A different layer set is a different event. Start clean rather than
          // inheriting last year's sort.
          if (state.activeLayerSetId !== snapshot.id) {
            return { activeLayerSetId: snapshot.id, sortId: snapshot.sorts[0]?.id ?? null };
          }
          // Same event: keep the user's choice, so a refetch cannot undo a sort
          // they just picked. Mirrors useMapLayerStore's seeding rule.
          return { sortId: state.sortId ?? snapshot.sorts[0]?.id ?? null };
        }),

      setSortId: (sortId) => set({ sortId }),

      setSelectedStackKey: (stackKey) => set({ selectedStackKey: stackKey }),
    }),
    {
      name: 'eventmap',
      // Every bump has left a key behind: v2 dropped `clockOffset`, v3 dropped
      // `layerVisibility` and `selectedChips` when the snapshot stopped carrying
      // layers and chip groups. persist shallow-merges the stored blob over the
      // initial state, so without a migration an existing install would
      // reintroduce each as a stray property the types no longer describe.
      version: 3,
      migrate: (persisted) => {
        if (persisted && typeof persisted === 'object') {
          const blob = persisted as Record<string, unknown>;
          delete blob.clockOffset;
          delete blob.layerVisibility;
          delete blob.selectedChips;
        }
        return persisted as EventMapStore;
      },
      storage: createJSONStorage(() => mmkvStateStorage),
      // selectedStackKey is excluded deliberately: a peek sheet reopening on
      // cold start, for a booth the user tapped yesterday, is never right.
      partialize: (state) => ({
        activeLayerSetId: state.activeLayerSetId,
        sortId: state.sortId,
      }),
    },
  ),
);
