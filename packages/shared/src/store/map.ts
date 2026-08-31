/**
 * Map layer state — ephemeral (not persisted).
 *
 * It holds ONLY what the user expressed, and that is the whole design. It used
 * to hold resolved visibility, seeded from each layer's `defaultVisible` by an
 * `initFromConfig` action — after which nothing could tell a value the user had
 * chosen from one the server had suggested. Two bugs followed from that single
 * conflation, and neither was fixable while it stood:
 *
 *  - A default that varies with the clock could never reach the screen, because
 *    at 18:00 the store still held the boolean written at 11:00, recorded as if
 *    the user had picked it.
 *  - The chip clear control could only restore the SERVER's defaults, because
 *    the user's own choices had been overwritten by the chip's group write and
 *    were not distinguishable from the defaults anyway. That is the bug where
 *    turning 편의시설 on, tapping 주점, and clearing left 편의시설 off again.
 *
 * So: `overrides` is the user's own layer preferences and an absent id means "no
 * opinion", which is what lets `defaultVisibleAt` answer and move with the
 * clock. `chip` is a transient narrowing laid over the top, so clearing it drops
 * a shadow rather than writing anything, and what comes back is what the user
 * had. `map/chips.ts` `isLayerVisible` is the one reader of both.
 *
 * `selectedCampus` initializes from `useSettingsStore.preferredCampus`
 * and syncs back on change.
 *
 * Flutter source: lib/features/campus_map/controller/map_layer_controller.dart
 */

import { create } from 'zustand';
import { useSettingsStore, type Campus } from './settings';

interface MapLayerState {
  /**
   * `Campus`, not `string`. It is seeded from `preferredCampus` (already a
   * `Campus`) and written back to it, so widening here only created a round trip
   * that had to be cast away again on the way out.
   */
  selectedCampus: Campus;
  /**
   * What the user expressed, and nothing else. An id absent from this record has
   * no opinion attached to it and the layer's own schedule answers.
   *
   * Never seeded. A layer the server stops serving simply stops being asked
   * about, which also closes a leak the old shape had: entries were created on
   * first sight and never removed, so a layer dropped from a later config kept
   * its entry for the rest of the session.
   */
  overrides: Record<string, boolean>;
  /**
   * The chip narrowing currently laid over `overrides`, or `null`.
   *
   * Stored rather than derived, reversing what this map used to do. The derived
   * form answered "which chip describes the layers as they are", which is a
   * function of the present — and "put it back the way it was" is not
   * recoverable from the present. It also stopped being derivable for the reset
   * chip at all once defaults began varying with the clock.
   */
  chip: { id: string; visibility: Record<string, boolean> } | null;
}

interface MapLayerActions {
  /**
   * The user's own toggle, from the filter sheet.
   *
   * Takes the target rather than flipping, because the caller has already
   * resolved the current value through `isLayerVisible` — recomputing it here
   * would mean handing the store a `now` and the layer definitions, which is a
   * lot of surface for an answer the caller is holding.
   *
   * It COMMITS the active chip's visibility into `overrides` before writing, so
   * a hand edit keeps exactly what is on screen. Without that step the strip
   * would vanish and every other layer in the group would snap back at the same
   * moment, which reads as the map undoing something the user did not ask it to.
   */
  setLayerOverride: (id: string, visible: boolean) => void;
  /**
   * Narrow to a chip's view. One commit, not a loop: a chip's write is one
   * decision — "within this group, these exactly" — and applying it layer by
   * layer would put it on screen as a sequence of partial states.
   *
   * It does NOT touch `overrides`. That is what makes the clear below able to
   * give the user their own choices back.
   */
  setChip: (id: string, visibility: Record<string, boolean>) => void;
  /** Leave the narrowed view. `overrides` is untouched, so it re-emerges. */
  clearChip: () => void;
  setSelectedCampus: (id: Campus) => void;
}

export type MapLayerStore = MapLayerState & MapLayerActions;

export const useMapLayerStore = create<MapLayerStore>((set) => ({
  selectedCampus: useSettingsStore.getState().preferredCampus,
  overrides: {},
  chip: null,

  setLayerOverride: (id, visible) => {
    set((state) => ({
      // The chip's own resolution is folded in first, so the layers it had
      // narrowed keep the values they are being shown with rather than falling
      // back to their schedules the instant an unrelated tile is tapped.
      overrides: { ...state.overrides, ...(state.chip?.visibility ?? {}), [id]: visible },
      // A hand edit means no chip describes the map any more, which is what
      // takes the active-chip strip down. The old code got this for free from
      // `findNarrowedChip` no longer matching; now it is said outright.
      chip: null,
    }));
  },

  setChip: (id, visibility) => {
    set({ chip: { id, visibility } });
  },

  clearChip: () => {
    set({ chip: null });
  },

  setSelectedCampus: (id) => {
    set({ selectedCampus: id });
    // Sync back to persisted settings. No cast — `id` is already a Campus.
    useSettingsStore.getState().setPreferredCampus(id);
  },
}));

/*
 * `initFromConfig`, `toggleLayer`, `setLayersVisible`, `setLayerStatus` and the
 * `status` field are gone.
 *
 * The first three are replaced above. `setLayerStatus` and `status` were already
 * dead — nothing called the action and nothing read the field — and dropping
 * `initFromConfig` made that provable rather than merely true: it was the only
 * thing that ever created an entry, and the action's `if (!current) return`
 * guard would have made every call a no-op.
 */
