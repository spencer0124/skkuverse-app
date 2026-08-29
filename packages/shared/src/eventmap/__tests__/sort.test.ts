/**
 * List sorting.
 *
 * Pins are positional and a stack's order is `compareForStack`'s, so the list is
 * the only place a sort is observable — and the one that would hurt in
 * production if it regressed: a sort must be a total order or the list
 * reshuffles itself on every status tick.
 */

import { describe, it, expect } from 'vitest';
import { sortItems } from '../derive';
import type { EventMapItem } from '../../types/eventmap';
import snapshotFixture from './fixtures/eskara-snapshot.json';

const ITEMS = snapshotFixture.items as unknown as EventMapItem[];
const ids = (items: readonly EventMapItem[]) => items.map((i) => i.id);

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
