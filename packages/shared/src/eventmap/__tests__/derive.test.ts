/**
 * Stacks and the list's layer filter.
 *
 * The ordering assertions matter more than they look: `pinPriority` plus status
 * alone leaves ties, and a tie means the lead can differ between two renders of
 * the same data — so the peek sheet's first card flickers every time status
 * re-derives. The shuffle test is the regression guard.
 */

import { describe, it, expect } from 'vitest';
import { buildStacks, deriveItems, selectVisibleItems } from '../derive';
import type { EventMapItem } from '../../types/eventmap';
import type { MapLayerDef } from '../../types/map';

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
    layerId: 'eskara26_booth',
    pinPriority: 0,
    cardTemplateId: 'booth',
    order: 0,
    media: { thumbnailUrl: null, images: [] },
    fields: {},
    actions: [],
    ...over,
  }) as EventMapItem;

/** A `/map/config` layer — the kind an item's `layerId` names. */
const mapLayer = (over: Partial<MapLayerDef> & { id: string }): MapLayerDef => ({
  type: 'marker',
  label: over.id,
  defaultVisible: true,
  endpoint: '/map/markers/event',
  chipGroupId: 'eskara-2026',
  userConfigurable: true,
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
    // Referential stability matters: the list rows and the peek sheet are keyed
    // on item identity, so a fresh object per item on every tick would rebuild
    // every row.
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

describe('selectVisibleItems', () => {
  const bar = item({ id: 'bar-1', layerId: 'eskara26_bar' });
  const food = item({ id: 'food-1', layerId: 'eskara26_food' });
  const layers = [mapLayer({ id: 'eskara26_bar' }), mapLayer({ id: 'eskara26_food' })];
  const ids = (items: readonly EventMapItem[]) => items.map((i) => i.id);

  it('lists exactly the items whose layer is drawn', () => {
    const out = selectVisibleItems({
      items: [bar, food],
      layers,
      states: { eskara26_bar: { visible: true }, eskara26_food: { visible: false } },
    });
    expect(ids(out)).toEqual(['bar-1']);
  });

  it("falls back to the layer's own default for a layer the store has not seen", () => {
    // The same rule the map draws by: `states[id]?.visible ?? defaultVisible`.
    // A store that has seen nothing yet must list what the map is showing.
    expect(ids(selectVisibleItems({ items: [bar, food], layers, states: {} }))).toEqual([
      'bar-1',
      'food-1',
    ]);
    const hiddenByDefault = [
      mapLayer({ id: 'eskara26_bar' }),
      mapLayer({ id: 'eskara26_food', defaultVisible: false }),
    ];
    expect(
      ids(selectVisibleItems({ items: [bar, food], layers: hiddenByDefault, states: {} })),
    ).toEqual(['bar-1']);
  });

  it('lists nothing for an item naming a layer this build was not served', () => {
    // No layer, no pin — and the marker route only serves markers for served
    // layers, so the list stays in step with the map for an id outside the
    // activation window too.
    const stray = item({ id: 'stray', layerId: 'eskara27_bar' });
    expect(selectVisibleItems({ items: [stray], layers, states: {} })).toEqual([]);
  });

  it('keeps the order it was given, so a sort applied upstream survives', () => {
    expect(ids(selectVisibleItems({ items: [food, bar], layers, states: {} }))).toEqual([
      'food-1',
      'bar-1',
    ]);
  });

  it('returns nothing when every layer is hidden', () => {
    const states = { eskara26_bar: { visible: false }, eskara26_food: { visible: false } };
    expect(selectVisibleItems({ items: [bar, food], layers, states })).toEqual([]);
  });
});
