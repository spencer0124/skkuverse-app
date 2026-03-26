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
import { useSettingsStore } from './settings';

type LayerStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface LayerState {
  visible: boolean;
  status: LayerStatus;
}

interface MapLayerState {
  selectedCampus: string;
  layers: Record<string, LayerState>;
}

interface MapLayerActions {
  initFromConfig: (layerDefs: MapLayerDef[]) => void;
  toggleLayer: (id: string) => void;
  setSelectedCampus: (id: string) => void;
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

  setSelectedCampus: (id) => {
    set({ selectedCampus: id });
    // Sync back to persisted settings
    useSettingsStore.getState().setPreferredCampus(id as 'hssc' | 'nsc');
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
