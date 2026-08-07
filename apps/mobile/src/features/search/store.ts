/**
 * Map navigation store — bridges a producer to the campus screen.
 *
 * Expo Router doesn't support returning data from router.back(), so a producer
 * sets a pending payload and CampusScreen reads + clears it in a useEffect.
 *
 * Two producers today, which is why the name is no longer producer-specific:
 *   - SearchScreen, which resolves a building and calls router.back()
 *   - `skkuverse://map?place=<id>`, via lib/pending-map-place-link.ts
 *
 * The file still lives under features/search because that is where the first
 * producer was; moving it is a rename with no behaviour change and is not worth
 * bundling into one.
 */

import { create } from 'zustand';
import type { MapNavPayload } from '@skkuverse/shared';

interface MapNavState {
  pendingNavPayload: MapNavPayload | null;
  setPendingNavPayload: (payload: MapNavPayload) => void;
  /** Read-and-clear in one call, so a payload cannot be consumed twice. */
  clearPendingNavPayload: () => MapNavPayload | null;
}

export const useMapNavStore = create<MapNavState>((set, get) => ({
  pendingNavPayload: null,

  setPendingNavPayload: (payload) => set({ pendingNavPayload: payload }),

  clearPendingNavPayload: () => {
    const current = get().pendingNavPayload;
    set({ pendingNavPayload: null });
    return current;
  },
}));
