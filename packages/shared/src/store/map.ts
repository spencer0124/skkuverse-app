/**
 * Map layer state — ephemeral (not persisted).
 *
 * Tracks which campus is selected and which layers are visible.
 * `selectedCampus` initializes from `useSettingsStore.preferredCampus`
 * and syncs back on change.
 *
 * Flutter source: lib/features/campus_map/controller/map_layer_controller.dart
 */

import { create } from 'zustand';
import type { MapLayerDef } from '../types/map';
import { useSettingsStore, type Campus } from './settings';

type LayerStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface LayerState {
  visible: boolean;
  status: LayerStatus;
}

interface MapLayerState {
  /**
   * `Campus`, not `string`. It is seeded from `preferredCampus` (already a
   * `Campus`) and written back to it, so widening here only created a round trip
   * that had to be cast away again on the way out.
   */
  selectedCampus: Campus;
  layers: Record<string, LayerState>;
}

interface MapLayerActions {
  initFromConfig: (layerDefs: MapLayerDef[]) => void;
  toggleLayer: (id: string) => void;
  /**
   * Set several layers at once, which is what a chip tap does.
   *
   * A separate action from `toggleLayer` rather than a loop over it, because a
   * chip's write is one decision — "within this group, these exactly" — and
   * looping would put it on screen as a sequence of partial states, each one a
   * render where some layers had moved and others had not.
   */
  setLayersVisible: (next: Record<string, boolean>) => void;
  setSelectedCampus: (id: Campus) => void;
  setLayerStatus: (id: string, status: LayerStatus) => void;
}

export type MapLayerStore = MapLayerState & MapLayerActions;

export const useMapLayerStore = create<MapLayerStore>((set) => ({
  selectedCampus: useSettingsStore.getState().preferredCampus,
  layers: {},

  initFromConfig: (layerDefs) => {
    set((state) => {
      // Only init layers not already tracked (preserve user toggles on re-fetch)
      const next = { ...state.layers };
      for (const def of layerDefs) {
        if (!(def.id in next)) {
          next[def.id] = { visible: def.defaultVisible, status: 'idle' };
        }
      }
      return { layers: next };
    });
  },

  toggleLayer: (id) => {
    set((state) => {
      const current = state.layers[id];
      if (!current) return state;
      return {
        layers: {
          ...state.layers,
          [id]: { ...current, visible: !current.visible },
        },
      };
    });
  },

  setLayersVisible: (next) => {
    set((state) => {
      const layers = { ...state.layers };
      for (const [id, visible] of Object.entries(next)) {
        const current = layers[id];
        // Only ids already tracked, the same guard `toggleLayer` uses. A chip
        // naming a layer this config does not serve must not mint an entry for
        // it: nothing would ever render it, and it would then shadow the real
        // layer's `defaultVisible` if the server started serving one.
        if (!current) continue;
        layers[id] = { ...current, visible };
      }
      return { layers };
    });
  },

  setSelectedCampus: (id) => {
    set({ selectedCampus: id });
    // Sync back to persisted settings. No cast — `id` is already a Campus.
    useSettingsStore.getState().setPreferredCampus(id);
  },

  setLayerStatus: (id, status) => {
    set((state) => {
      const current = state.layers[id];
      if (!current) return state;
      return {
        layers: {
          ...state.layers,
          [id]: { ...current, status },
        },
      };
    });
  },
}));
