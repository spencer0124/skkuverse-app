/**
 * Chip composition and list sorting.
 *
 * The composition rule is the app's, not the server's — the wire carries
 * predicates and never says how to combine them — so these are the only place
 * it is pinned down. The two that would hurt in production if they regressed:
 * an empty group must widen rather than empty the map, and a sort must be a
 * total order or the list reshuffles itself on every status tick.
 */

import { describe, it, expect } from 'vitest';
import { selectMatchingItems, sortItems } from '../derive';
import type { EventMapChipGroup, EventMapItem } from '../../types/eventmap';
import snapshotFixture from './fixtures/eskara-snapshot.json';

const ITEMS = snapshotFixture.items as unknown as EventMapItem[];
const GROUPS = snapshotFixture.chipGroups as unknown as EventMapChipGroup[];

const group = (id: string): EventMapChipGroup => {
  const found = GROUPS.find((g) => g.id === id);
  if (!found) throw new Error(`fixture has no chip group ${id}`);
  return found;
};

const ids = (items: readonly EventMapItem[]) => items.map((i) => i.id);

describe('selectMatchingItems', () => {
  it('returns everything when no group has a selection', () => {
    expect(selectMatchingItems({ items: ITEMS, chipGroups: GROUPS, selectedChips: {} })).toHaveLength(
      ITEMS.length,
    );
  });

  it('treats an empty group as no constraint, never as "match nothing"', () => {
    // The failure this guards is severe and silent: deselecting the last chip in
    // a group would otherwise clear the entire map with no error anywhere.
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: GROUPS,
      selectedChips: { day: [], slot: [], category: [], now: [] },
    });
    expect(out).toHaveLength(ITEMS.length);
  });

  it('ORs within a group', () => {
    const both = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('slot')],
      selectedChips: { slot: ['slot_day', 'slot_night'] },
    });
    const dayOnly = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('slot')],
      selectedChips: { slot: ['slot_day'] },
    });
    expect(both.length).toBeGreaterThan(dayOnly.length);
    expect(ids(both)).toEqual(expect.arrayContaining(ids(dayOnly)));
  });

  it('ANDs across groups', () => {
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('slot'), group('category')],
      selectedChips: { slot: ['slot_night'], category: ['cat_stage'] },
    });
    // 메인 스테이지 is the only slot:night AND cat:stage session in the fixture.
    expect(ids(out)).toEqual(['demo-stage-main']);
  });

  it('resolves hasAny across two tags', () => {
    // cat_food is ["hasAny", ["cat:food", "cat:bar"]] — one chip, two categories.
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('category')],
      selectedChips: { category: ['cat_food'] },
    });
    expect(ids(out).sort()).toEqual(
      ['demo-closed-food', 'demo-nightbar-d1-02', 'demo-rain-cancelled'].sort(),
    );
  });

  it('matches a status chip against the DERIVED status on the item', () => {
    // open_now is ["status", ["open"]]. The pipeline hands this function items
    // whose status deriveItems already recomputed, so this reads that field.
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('now')],
      selectedChips: { now: ['open_now'] },
    });
    expect(out.every((i) => i.status === 'open')).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('ignores a selected id with no surviving chip', () => {
    // A persisted selection can outlive its chip: the parser drops a chip whose
    // predicate fails validation. Counting that as a miss would empty the map
    // over a config typo.
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('category')],
      selectedChips: { category: ['cat_stage', 'cat_deleted_last_year'] },
    });
    expect(ids(out)).toEqual(['demo-stage-main']);
  });

  it('treats a group whose every selected id is unknown as no constraint', () => {
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: [group('category')],
      selectedChips: { category: ['nope'] },
    });
    expect(out).toHaveLength(ITEMS.length);
  });

  it('ignores a selection naming a group that is not in the snapshot', () => {
    const out = selectMatchingItems({
      items: ITEMS,
      chipGroups: GROUPS,
      selectedChips: { retired_group: ['whatever'] },
    });
    expect(out).toHaveLength(ITEMS.length);
  });
});

describe('sortItems', () => {
  it('sorts by order', () => {
    const out = sortItems(ITEMS, 'order');
    expect(out.map((i) => i.order)).toEqual([...ITEMS].map((i) => i.order).sort((a, b) => a - b));
  });

  it('sorts by title', () => {
    const titles = sortItems(ITEMS, 'title').map((i) => i.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts by startAt with nulls last', () => {
    // An item with no start time is unknown, not "infinitely soon" — it belongs
    // at the bottom of 시작 임박순, not the top.
    const out = sortItems(ITEMS, 'startAt');
    const firstNull = out.findIndex((i) => i.startAt === null);
    expect(firstNull).toBeGreaterThan(-1);
    expect(out.slice(firstNull).every((i) => i.startAt === null)).toBe(true);
  });

  it('is a total order — input order cannot change the result', () => {
    // The flicker regression, same shape as buildStacks'. The list re-derives on
    // every statusEpoch tick, so a tie reshuffles rows under the user's finger.
    const tied: EventMapItem[] = ITEMS.map((i) => ({ ...i, order: 0, startAt: null }));
    for (const by of ['order', 'title', 'startAt'] as const) {
      const forward = ids(sortItems(tied, by));
      const reversed = ids(sortItems([...tied].reverse(), by));
      expect(reversed).toEqual(forward);
    }
  });

  it('does not mutate its input', () => {
    const before = ids(ITEMS);
    sortItems(ITEMS, 'title');
    expect(ids(ITEMS)).toEqual(before);
  });
});
