/**
 * Stacks and visibility.
 *
 * The ordering assertions matter more than they look: `pinPriority` plus status
 * alone leaves ties, and a tie means the lead can differ between two renders of
 * the same data — so the marker's icon and caption flicker every time status
 * re-derives. The shuffle test is the regression guard.
 */

import { describe, it, expect } from 'vitest';
import { buildStacks, deriveItems, selectVisibleStacks } from '../derive';
import type { EventMapItem, EventMapLayer, Predicate } from '../../types/eventmap';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-09-16T03:00:00.000Z');

const item = (over: Partial<EventMapItem> = {}): EventMapItem =>
  ({
    id: 'i1',
    placeId: 'p1',
    stackKey: 'p1',
    lat: 37.29,
    lng: 126.97,
    title: 'T',
    subtitle: null,
    tags: [],
    status: 'unknown',
    startAt: null,
    endAt: null,
    hoursLabel: null,
    iconId: 'generic',
    iconIdClosed: null,
    pinPriority: 0,
    cardTemplateId: 'booth',
    order: 0,
    media: { thumbnailUrl: null, images: [] },
    fields: {},
    actions: [],
    ...over,
  }) as EventMapItem;

const layer = (over: Partial<EventMapLayer> = {}): EventMapLayer => ({
  id: 'l1',
  render: 'pin',
  label: 'L',
  filter: ['all'] as Predicate,
  defaultVisible: true,
  minZoom: null,
  maxZoom: null,
  iconId: 'generic',
  sortId: 'manual',
  ...over,
});

describe('deriveItems', () => {
  it('replaces the shipped status with the clock-derived one', () => {
    const i = item({
      status: 'upcoming',
      startAt: new Date(T0).toISOString(),
      endAt: new Date(T0 + 4 * HOUR).toISOString(),
    });
    expect(deriveItems([i], T0 + HOUR)[0]!.status).toBe('open');
  });

  it('returns the same object when nothing changed, keeping references stable', () => {
    // Referential stability matters: EventMapPinLayer is memoized, so a fresh
    // object per item on every tick would rebuild every overlay.
    const i = item({ status: 'open' });
    expect(deriveItems([i], T0)[0]).toBe(i);
  });
});

describe('buildStacks', () => {
  it('draws one stack per stackKey', () => {
    const { stacks } = buildStacks([
      item({ id: 'a', stackKey: 'plaza' }),
      item({ id: 'b', stackKey: 'plaza' }),
      item({ id: 'c', stackKey: 'field' }),
    ]);
    expect(stacks).toHaveLength(2);
    expect(stacks.find((s) => s.stackKey === 'plaza')!.items).toHaveLength(2);
  });

  it('leads with the highest pinPriority', () => {
    const { stacks } = buildStacks([
      item({ id: 'low', stackKey: 'k', pinPriority: 10 }),
      item({ id: 'high', stackKey: 'k', pinPriority: 40 }),
    ]);
    expect(stacks[0]!.lead.id).toBe('high');
  });

  it('breaks a priority tie by status rank, so an open booth wins the pin', () => {
    const { stacks } = buildStacks([
      item({ id: 'closed', stackKey: 'k', pinPriority: 20, status: 'closed' }),
      item({ id: 'open', stackKey: 'k', pinPriority: 20, status: 'open' }),
    ]);
    expect(stacks[0]!.lead.id).toBe('open');
  });

  it('breaks a status tie by order, then by id', () => {
    const { stacks } = buildStacks([
      item({ id: 'b', stackKey: 'k', order: 1 }),
      item({ id: 'a', stackKey: 'k', order: 1 }),
      item({ id: 'c', stackKey: 'k', order: 0 }),
    ]);
    expect(stacks[0]!.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('picks the same lead regardless of input order — the flicker regression', () => {
    // Without `order` then `id` as final tiebreakers, a fully-tied stack's lead
    // depends on array order, which changes the drawn icon between renders.
    const tied = [
      item({ id: 'x', stackKey: 'k', pinPriority: 20, status: 'open', order: 0 }),
      item({ id: 'y', stackKey: 'k', pinPriority: 20, status: 'open', order: 0 }),
      item({ id: 'z', stackKey: 'k', pinPriority: 20, status: 'open', order: 0 }),
    ];
    const forward = buildStacks(tied).stacks[0]!.lead.id;
    const reversed = buildStacks([...tied].reverse()).stacks[0]!.lead.id;
    expect(forward).toBe(reversed);
  });

  it('indexes every placeId so a deep link can resolve one', () => {
    const { byPlaceId } = buildStacks([
      item({ id: 'a', placeId: 'plaza-a3', stackKey: 'zone-right' }),
      item({ id: 'b', placeId: 'plaza-a4', stackKey: 'zone-right' }),
    ]);
    // Both resolve to the same stack — that is what stackKey: zone means.
    expect(byPlaceId.get('plaza-a3')!.stackKey).toBe('zone-right');
    expect(byPlaceId.get('plaza-a4')!.stackKey).toBe('zone-right');
    expect(byPlaceId.get('nope')).toBeUndefined();
  });
});

describe('selectVisibleStacks', () => {
  const { stacks } = buildStacks([item({ id: 'bar', tags: ['cat:bar'], status: 'open' })]);

  it('keeps a stack admitted by a visible layer', () => {
    const out = selectVisibleStacks({
      stacks,
      layers: [layer({ id: 'bar', filter: ['has', 'cat:bar'] })],
      layerVisibility: { bar: true },
    });
    expect(out).toHaveLength(1);
  });

  it('drops a stack no visible layer admits', () => {
    const out = selectVisibleStacks({
      stacks,
      layers: [layer({ id: 'food', filter: ['has', 'cat:food'] })],
      layerVisibility: { food: true },
    });
    expect(out).toHaveLength(0);
  });

  it('falls back to defaultVisible for a layer the store has not seen', () => {
    expect(
      selectVisibleStacks({ stacks, layers: [layer({ defaultVisible: true })], layerVisibility: {} }),
    ).toHaveLength(1);
    expect(
      selectVisibleStacks({ stacks, layers: [layer({ defaultVisible: false })], layerVisibility: {} }),
    ).toHaveLength(0);
  });

  it('shows an item any visible layer admits, not only one all of them do', () => {
    const out = selectVisibleStacks({
      stacks,
      layers: [
        layer({ id: 'bar', filter: ['has', 'cat:bar'] }),
        layer({ id: 'food', filter: ['has', 'cat:food'] }),
      ],
      layerVisibility: { bar: true, food: true },
    });
    expect(out).toHaveLength(1);
  });

  it('takes the most permissive zoom when two admitting layers disagree', () => {
    // A pin must not vanish because a SECOND layer also matched it. The ESKARA
    // layers really do range minZoom 14-16.
    const out = selectVisibleStacks({
      stacks,
      layers: [
        layer({ id: 'a', minZoom: 16, maxZoom: 18 }),
        layer({ id: 'b', minZoom: 14, maxZoom: 20 }),
      ],
      layerVisibility: { a: true, b: true },
    });
    expect(out[0]).toMatchObject({ minZoom: 14, maxZoom: 20 });
  });

  it('treats a null bound as unbounded, which beats any number', () => {
    const out = selectVisibleStacks({
      stacks,
      layers: [layer({ id: 'a', minZoom: 16 }), layer({ id: 'b', minZoom: null })],
      layerVisibility: { a: true, b: true },
    });
    expect(out[0]!.minZoom).toBeNull();
  });

  it('carries a single layer bound through unchanged', () => {
    const out = selectVisibleStacks({
      stacks,
      layers: [layer({ minZoom: 15, maxZoom: null })],
      layerVisibility: { l1: true },
    });
    expect(out[0]).toMatchObject({ minZoom: 15, maxZoom: null });
  });

  it('returns nothing when every layer is hidden, without evaluating predicates', () => {
    expect(
      selectVisibleStacks({ stacks, layers: [layer()], layerVisibility: { l1: false } }),
    ).toEqual([]);
  });
});
