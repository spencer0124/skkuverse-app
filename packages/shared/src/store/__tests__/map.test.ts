/**
 * Map layer state — what the user expressed, and the chip laid over it.
 *
 * The store holds no resolved visibility at all any more. It used to, seeded
 * from each layer's `defaultVisible`, and the two bugs that followed are the
 * reason this suite exists in its current shape:
 *
 *  - A default that varies with the clock could never reach the screen, because
 *    the value written at 11:00 was recorded as if the user had chosen it.
 *  - Clearing a chip could only restore the SERVER's defaults, because the
 *    user's own choices had been overwritten by the chip's group write.
 *
 * `isLayerVisible` resolves the two records this holds against a layer's own
 * schedule; the tests for that live in `map/__tests__/chips.test.ts`. What is
 * asserted here is narrower and is the half that was broken: a chip SHADOWS and
 * never assigns, so dropping it gives the user back exactly what they had.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMapLayerStore } from '../map';

// Native module — importing it in Node fails outright. The settings store this
// one seeds `selectedCampus` from reaches MMKV at module load.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

/** What a chip tap over the festival group resolves to — 주점 alone. */
const BAR_ONLY = {
  eskara26_stage: false,
  eskara26_bar: true,
  eskara26_facility: false,
};

const store = () => useMapLayerStore.getState();

beforeEach(() => {
  useMapLayerStore.setState({ overrides: {}, chip: null });
});

describe('a fresh store has no opinion about anything', () => {
  it('starts with no overrides and no chip', () => {
    // Not "everything hidden" and not "everything at its default" — nothing is
    // recorded at all, which is what leaves `defaultVisibleAt` free to answer
    // and to keep answering differently as the clock moves.
    expect(store().overrides).toEqual({});
    expect(store().chip).toBeNull();
  });
});

describe('setChip — a narrowing that shadows rather than assigns', () => {
  it('records the tap without touching what the user chose', () => {
    store().setLayerOverride('eskara26_facility', true);
    store().setChip('eskara26_view_bar', BAR_ONLY);

    expect(store().chip).toEqual({ id: 'eskara26_view_bar', visibility: BAR_ONLY });
    expect(store().overrides.eskara26_facility).toBe(true);
  });

  it('replaces one narrowing with the next rather than merging them', () => {
    store().setChip('eskara26_view_bar', BAR_ONLY);
    store().setChip('eskara26_view_stage', { eskara26_stage: true, eskara26_bar: false });

    expect(store().chip?.id).toBe('eskara26_view_stage');
    expect(store().chip?.visibility).toEqual({
      eskara26_stage: true,
      eskara26_bar: false,
    });
  });
});

describe('clearChip — 편의시설 comes back on', () => {
  it('restores what the user had, not what the server ships', () => {
    // The reported bug, end to end at the store level. Check 편의시설 on, tap
    // 주점, clear — and 편의시설 must still be on. It used to come back OFF,
    // because the clear control wrote each layer's `defaultVisible` and 편의시설
    // ships hidden.
    store().setLayerOverride('eskara26_facility', true);
    store().setChip('eskara26_view_bar', BAR_ONLY);
    store().clearChip();

    expect(store().chip).toBeNull();
    expect(store().overrides.eskara26_facility).toBe(true);
  });

  it('leaves a layer the user never touched with no entry at all', () => {
    // So it returns to its own schedule rather than to a boolean captured on the
    // way in. An entry here would be the freeze this whole shape avoids.
    store().setChip('eskara26_view_bar', BAR_ONLY);
    store().clearChip();

    expect(store().overrides).not.toHaveProperty('eskara26_bar');
    expect(store().overrides).not.toHaveProperty('eskara26_stage');
  });

  it('is a no-op when nothing was narrowed', () => {
    store().setLayerOverride('eskara26_bar', false);
    store().clearChip();
    expect(store().overrides).toEqual({ eskara26_bar: false });
  });
});

describe('setLayerOverride — a hand edit takes the view as it stands', () => {
  it('records exactly what it was asked for', () => {
    store().setLayerOverride('eskara26_bar', false);
    expect(store().overrides.eskara26_bar).toBe(false);
  });

  it('commits the active chip before writing, so nothing else jumps', () => {
    // Toggling one tile while narrowed drops the strip. If the chip's values
    // were not folded into `overrides` first, every OTHER layer in the group
    // would snap back to its schedule at the same moment — the map undoing
    // something the user did not ask it to.
    store().setChip('eskara26_view_bar', BAR_ONLY);
    store().setLayerOverride('eskara26_facility', true);

    expect(store().chip).toBeNull();
    expect(store().overrides).toEqual({ ...BAR_ONLY, eskara26_facility: true });
  });

  it('lets the tapped layer win over the chip value it is committing', () => {
    // 주점 is on in the narrowing; switching it off has to survive the commit
    // rather than being overwritten by the value being folded in beside it.
    store().setChip('eskara26_view_bar', BAR_ONLY);
    store().setLayerOverride('eskara26_bar', false);

    expect(store().overrides.eskara26_bar).toBe(false);
  });

  it('accepts an id no config served, because nothing is seeded any more', () => {
    // The old store refused an unknown id, since minting an entry would shadow
    // a real layer's default the day the server started serving one. There is
    // nothing to shadow now: an override is only ever consulted for a layer the
    // config lists, so a stale id is inert rather than dangerous.
    store().setLayerOverride('eskara27_ghost', true);
    expect(store().overrides.eskara27_ghost).toBe(true);
  });
});
