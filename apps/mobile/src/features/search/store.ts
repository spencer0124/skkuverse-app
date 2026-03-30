/**
 * Search result navigation store — bridges search → campus screen.
 *
 * Expo Router doesn't support returning data from router.back().
 * Search screen sets a pending payload, calls router.back(),
 * and CampusScreen reads + clears it in useEffect.
 */

import { create } from 'zustand';
import type { BuildingNavPayload } from '@skkuverse/shared';

interface SearchResultState {
  pendingNavPayload: BuildingNavPayload | null;
  setPendingNavPayload: (payload: BuildingNavPayload) => void;
  clearPendingNavPayload: () => BuildingNavPayload | null;
}

export const useSearchResultStore = create<SearchResultState>((set, get) => ({
  pendingNavPayload: null,

  setPendingNavPayload: (payload) => set({ pendingNavPayload: payload }),

  clearPendingNavPayload: () => {
    const current = get().pendingNavPayload;
    set({ pendingNavPayload: null });
    return current;
  },
}));
