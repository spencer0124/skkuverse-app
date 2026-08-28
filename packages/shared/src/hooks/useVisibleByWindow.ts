/**
 * Keep only the items whose time window is open, and re-render when that changes.
 *
 * The re-render is the whole point, and it is the part that looks unnecessary
 * until it bites. The payload either side of a boundary is BYTE-IDENTICAL — a
 * booth's opening time does not change when it opens — so React Query's
 * structural sharing preserves object identity, nothing re-renders, and 18:00
 * passes with the map unchanged. Invalidating the query does not help for the
 * same reason. The fix has to be a counter the filter depends on, which is why
 * this hook owns an epoch rather than exposing a predicate for callers to call.
 *
 * One one-shot timer per consumer, armed at the next boundary and re-armed when
 * it fires — never a per-second tick.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  MAX_TIMEOUT_MS,
  isWithinWindow,
  nextWindowBoundaryAfter,
  type TimeWindow,
} from '../map/window';

export function useVisibleByWindow<T extends TimeWindow>(
  items: readonly T[],
): T[] {
  const [epoch, setEpoch] = useState(0);

  // `epoch` is a dependency so the effect re-arms after each firing. Without it
  // the first boundary would be the only one this ever observed.
  useEffect(() => {
    const now = Date.now();
    const next = nextWindowBoundaryAfter(items, now);
    if (next === null) return;
    const delay = Math.min(Math.max(next - now, 0), MAX_TIMEOUT_MS);
    const timer = setTimeout(() => setEpoch((e) => e + 1), delay);
    return () => clearTimeout(timer);
  }, [items, epoch]);

  return useMemo(() => {
    const now = Date.now();
    return items.filter((item) => isWithinWindow(item, now));
    // `epoch` is read by nothing in the body and that is deliberate: it exists
    // to invalidate this memo at a boundary, since `items` is unchanged there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, epoch]);
}
