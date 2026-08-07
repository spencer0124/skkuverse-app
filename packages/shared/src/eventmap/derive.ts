/**
 * Snapshot → what the map actually draws.
 *
 * Three transforms, in order: re-derive each item's status against the server
 * clock, collapse co-located items into stacks (one marker each), then select
 * the stacks the visible layers admit.
 *
 * Pure, and deliberately in packages/shared rather than the app: vitest reaches
 * here, while apps/mobile's `node --test` runner does not reach `.tsx`. The
 * ordering rules below are exactly the kind of thing that needs a regression
 * test, so they live where one can be written.
 */

import type { EventMapItem, EventMapLayer, ItemStatus } from '../types/eventmap';
import { deriveItemStatus } from './clock';
import { evaluatePredicate } from './predicate';

/** An item whose `status` has been replaced by the clock-derived one. */
export type DerivedItem = EventMapItem;

export interface EventMapStack {
  stackKey: string;
  /** The item whose marker is drawn. */
  lead: DerivedItem;
  /** Every item on this key, lead first, in the same order the peek sheet lists them. */
  items: DerivedItem[];
  /** Most permissive bounds across the layers that admitted this stack. */
  minZoom: number | null;
  maxZoom: number | null;
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
 * the same data — so the marker's icon and caption flicker every time status
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
    const stack: EventMapStack = {
      stackKey,
      lead: sorted[0]!,
      items: sorted,
      minZoom: null,
      maxZoom: null,
    };
    stacks.push(stack);
    // Several items can share a placeId (day booth + night 주점). They resolve to
    // the same stack, so first-wins is not a choice being made here.
    for (const item of sorted) {
      if (!byPlaceId.has(item.placeId)) byPlaceId.set(item.placeId, stack);
    }
  }
  return { stacks, byPlaceId };
}

export interface VisibleStacksInput {
  stacks: readonly EventMapStack[];
  layers: readonly EventMapLayer[];
  /** Layer id → visible. A layer absent from the map falls back to `defaultVisible`. */
  layerVisibility: Readonly<Record<string, boolean>>;
}

/**
 * Keep stacks admitted by at least one visible layer, carrying that layer's zoom
 * bounds.
 *
 * Two rules the wire contract leaves open:
 *
 * - **Any, not all.** An item shown by a visible layer is shown, even if another
 *   visible layer's filter rejects it. Layers are additive views, not a
 *   conjunction.
 * - **Most permissive zoom.** When two admitting layers disagree, take
 *   `min(minZoom)` and `max(maxZoom)`. A pin must not vanish because a *second*
 *   layer also happened to match it. Live concern rather than hypothetical: the
 *   ESKARA layers range `minZoom` 14–16.
 *
 * Matching is on the LEAD item, which is what the marker represents.
 */
export function selectVisibleStacks({
  stacks,
  layers,
  layerVisibility,
}: VisibleStacksInput): EventMapStack[] {
  const visible = layers.filter((l) => layerVisibility[l.id] ?? l.defaultVisible);
  if (visible.length === 0) return [];

  const out: EventMapStack[] = [];
  for (const stack of stacks) {
    const subject = { tags: stack.lead.tags, status: stack.lead.status };
    const admitting = visible.filter((l) => evaluatePredicate(l.filter, subject));
    if (admitting.length === 0) continue;
    out.push({
      ...stack,
      minZoom: mergeBound(
        admitting.map((l) => l.minZoom),
        Math.min,
      ),
      maxZoom: mergeBound(
        admitting.map((l) => l.maxZoom),
        Math.max,
      ),
    });
  }
  return out;
}

/**
 * `null` means unbounded, which is maximally permissive — so a single unbounded
 * layer makes the merged bound unbounded, and otherwise the most permissive
 * numeric value wins.
 */
function mergeBound(
  values: readonly (number | null)[],
  pick: (a: number, b: number) => number,
): number | null {
  let out: number | null = null;
  for (const v of values) {
    if (v === null) return null;
    out = out === null ? v : pick(out, v);
  }
  return out;
}
