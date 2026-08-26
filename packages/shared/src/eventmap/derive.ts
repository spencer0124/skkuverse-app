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

import type {
  EventMapChipGroup,
  EventMapItem,
  EventMapLayer,
  ItemStatus,
  Predicate,
  SortKey,
} from '../types/eventmap';
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

export interface MatchingItemsInput {
  items: readonly DerivedItem[];
  chipGroups: readonly EventMapChipGroup[];
  /** Group id → selected chip ids. */
  selectedChips: Readonly<Record<string, string[]>>;
}

/**
 * Keep the items every chip group admits.
 *
 * The composition rule is the APP's, not the server's: the wire carries
 * predicates and never says how to combine them, and ADR 0004 puts predicate
 * evaluation on this side. So it is stated here rather than inferred at each
 * call site:
 *
 * - **OR within a group.** 주간 + 야간 selected shows both. A group is one axis,
 *   and selecting more of an axis widens it.
 * - **AND across groups.** 야간 AND 먹거리. Groups are independent axes, and
 *   selecting on a second one narrows.
 * - **An empty group is no constraint**, never "hide everything". ESKARA spells
 *   "all" as an explicit `day_all` chip whose predicate is `['all']`, so empty is
 *   not how the config expresses it — but a group can still arrive empty (every
 *   chip deselected, or every selected id dropped by the parser), and the answer
 *   to "you have chosen nothing" must not be an empty map.
 *
 * A selected id with no surviving chip is ignored rather than counted as a miss.
 * The parser drops a chip whose predicate fails validation, so a persisted
 * selection can outlive the chip it named; treating that as "matches nothing"
 * would empty the map over a config typo.
 *
 * Status comes from the DERIVED item, which is why this runs after `deriveItems`
 * — a `['status', ['open']]` chip has to track the clock.
 */
export function selectMatchingItems({
  items,
  chipGroups,
  selectedChips,
}: MatchingItemsInput): DerivedItem[] {
  // One pass over the config, not once per item.
  const axes: Predicate[][] = [];
  for (const group of chipGroups) {
    const selected = selectedChips[group.id];
    if (!selected || selected.length === 0) continue;
    const predicates = group.chips
      .filter((chip) => selected.includes(chip.id))
      .map((chip) => chip.predicate);
    if (predicates.length > 0) axes.push(predicates);
  }
  if (axes.length === 0) return [...items];

  return items.filter((item) => {
    const subject = { tags: item.tags, status: item.status };
    return axes.every((predicates) => predicates.some((p) => evaluatePredicate(p, subject)));
  });
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
 * Sort for a list view. Pins are positional and stack order is `compareForStack`'s,
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
