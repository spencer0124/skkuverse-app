/**
 * Snapshot → what the map and the list actually show.
 *
 * Two transforms, in order: re-derive each item's status against the clock,
 * then collapse co-located items into stacks (one peek sheet each). Beside them
 * sit the two selections the list needs — which items the visible layers admit,
 * and in what order.
 *
 * Pure, and deliberately in packages/shared rather than the app: vitest reaches
 * here, while apps/mobile's `node --test` runner does not reach `.tsx`. The
 * ordering rules below are exactly the kind of thing that needs a regression
 * test, so they live where one can be written.
 */

import type { EventMapItem, ItemStatus, SortKey } from '../types/eventmap';
import type { MapLayerDef } from '../types/map';
import { isLayerVisible, type LayerVisibilityStates } from '../map/chips';
import { deriveItemStatus } from './clock';

/** An item whose `status` has been replaced by the clock-derived one. */
export type DerivedItem = EventMapItem;

export interface EventMapStack {
  stackKey: string;
  /** The item whose marker is drawn. */
  lead: DerivedItem;
  /** Every item on this key, lead first, in the same order the peek sheet lists them. */
  items: DerivedItem[];
}

const STATUS_RANK: Record<ItemStatus, number> = {
  open: 0,
  upcoming: 1,
  closed: 2,
  unknown: 3,
};

/**
 * A TOTAL order, which matters more than it looks. `pinPriority` and status
 * alone leave ties, and a tie means the lead can differ between two renders of
 * the same data — so the peek sheet's first card flickers every time status
 * re-derives. `order` then `id` makes the result a pure function of the set.
 */
function compareForStack(a: DerivedItem, b: DerivedItem): number {
  if (a.pinPriority !== b.pinPriority) return b.pinPriority - a.pinPriority;
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Re-derive every item's status against `now` (server time). */
export function deriveItems(items: readonly EventMapItem[], now: number): DerivedItem[] {
  return items.map((item) => {
    const status = deriveItemStatus(item, now);
    return status === item.status ? item : { ...item, status };
  });
}

export interface BuiltStacks {
  stacks: EventMapStack[];
  /** placeId → the stack containing it. Deep-link resolution. */
  byPlaceId: Map<string, EventMapStack>;
}

export function buildStacks(items: readonly DerivedItem[]): BuiltStacks {
  const grouped = new Map<string, DerivedItem[]>();
  for (const item of items) {
    const existing = grouped.get(item.stackKey);
    if (existing) existing.push(item);
    else grouped.set(item.stackKey, [item]);
  }

  const stacks: EventMapStack[] = [];
  const byPlaceId = new Map<string, EventMapStack>();
  for (const [stackKey, group] of grouped) {
    const sorted = [...group].sort(compareForStack);
    const stack: EventMapStack = { stackKey, lead: sorted[0]!, items: sorted };
    stacks.push(stack);
    // Several items can share a placeId (day booth + night 주점). They resolve to
    // the same stack, so first-wins is not a choice being made here.
    for (const item of sorted) {
      if (!byPlaceId.has(item.placeId)) byPlaceId.set(item.placeId, stack);
    }
  }
  return { stacks, byPlaceId };
}

export interface VisibleItemsInput {
  items: readonly DerivedItem[];
  /** The `/map/config` layers this build was served. */
  layers: readonly MapLayerDef[];
  /** The map layer store's `layers` slice — the user's toggles. */
  states: LayerVisibilityStates;
}

/**
 * The items whose layer is drawn right now, in the order they were given.
 *
 * One rule, and it is the map's rule rather than a second one: an item is
 * listed exactly when its pin is. Both come down to `isLayerVisible` over the
 * same `/map/config` layer — the render loop, the filter badge, the filter
 * sheet's tiles and the chips already read it, and this is the fifth reader
 * rather than a fifth copy, so the list cannot show 주점 while the map hides it.
 *
 * An item naming a layer this build was not served is not listed. There is no
 * pin for it either: the marker route serves markers per served layer, so the
 * two stay in step for an id outside the activation window too.
 *
 * Order is preserved so a sort applied upstream survives the filter.
 */
export function selectVisibleItems({ items, layers, states }: VisibleItemsInput): DerivedItem[] {
  const visible = new Set<string>();
  for (const layer of layers) {
    if (isLayerVisible(layer, states)) visible.add(layer.id);
  }
  if (visible.size === 0) return [];
  return items.filter((item) => visible.has(item.layerId));
}

/**
 * `null` sorts last regardless of direction. An item with no start time is not
 * "infinitely soon"; it is unknown, and unknown belongs at the bottom of a
 * "시작 임박순" list rather than the top.
 */
function compareStartAt(a: DerivedItem, b: DerivedItem): number {
  const ta = a.startAt === null ? NaN : Date.parse(a.startAt);
  const tb = b.startAt === null ? NaN : Date.parse(b.startAt);
  const aMissing = Number.isNaN(ta);
  const bMissing = Number.isNaN(tb);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return ta - tb;
}

/**
 * Sort for the list. Pins are positional and stack order is `compareForStack`'s,
 * so this is the only place a sort is observable.
 *
 * Every comparator falls through to `id`, for the same reason `compareForStack`
 * does: a tie makes the result depend on input order, and the input is
 * re-derived on every `statusEpoch` tick — so a tie is a list that reshuffles
 * itself while the user is reading it.
 */
export function sortItems(items: readonly DerivedItem[], by: SortKey): DerivedItem[] {
  const primary =
    by === 'title'
      ? (a: DerivedItem, b: DerivedItem) => a.title.localeCompare(b.title)
      : by === 'startAt'
        ? compareStartAt
        : (a: DerivedItem, b: DerivedItem) => a.order - b.order;

  return [...items].sort((a, b) => {
    const rank = primary(a, b);
    if (rank !== 0) return rank;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
