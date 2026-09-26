/**
 * Event map client state — the one choice the marker payload cannot carry.
 *
 * Separate from `useMapLayerStore` on purpose: that one is where an event
 * layer's visibility lives — festival layers are ordinary served layers. What is
 * left here is which place has a sheet open.
 *
 * Not persisted. It used to be, for the list's sort and the layer set that sort
 * was keyed to; the list has one order now (`sortPlaces`), and a peek sheet
 * reopening on cold start, for a booth the user tapped yesterday, is never right.
 */

import { create } from 'zustand';

interface EventMapState {
  /**
   * Which place's peek sheet is open.
   *
   * A place id, not a stack key. Stacks existed because several sessions
   * collapsed onto one plot and a tap could not say which was meant; a place is
   * one document now and `tap.placeId` is its own id, so two booths sharing a
   * spot are two taps rather than one sheet listing both.
   */
  selectedPlaceId: string | null;
}

interface EventMapActions {
  setSelectedPlaceId: (placeId: string | null) => void;
}

export type EventMapStore = EventMapState & EventMapActions;

export const useEventMapStore = create<EventMapStore>()((set) => ({
  selectedPlaceId: null,
  setSelectedPlaceId: (placeId) => set({ selectedPlaceId: placeId }),
}));
