/**
 * A `now` that changes exactly when some place opens or closes.
 *
 * The re-render is the whole point, and it is the part that looks unnecessary
 * until it bites. The payload either side of a boundary is BYTE-IDENTICAL — a
 * booth's opening time does not change when it opens — so React Query's
 * structural sharing preserves object identity, nothing re-renders, and 18:00
 * passes with the map unchanged. Invalidating the query does not help for the
 * same reason. The fix has to be a value the derivation depends on, which is why
 * this hook owns the clock rather than exposing a predicate for callers to call.
 *
 * One one-shot timer per consumer, armed at the next boundary and re-armed when
 * it fires — never a per-second tick.
 *
 * This replaced `useVisibleByWindow`, which filtered markers to their open
 * windows. Hours do not decide what is DRAWN any more (map-markers-api §3.3):
 * the pin filtering they used to drive was how the old map coped with a crowded
 * field, which was a workaround for the day-split rather than a feature. Layers
 * and chips do that job now, and a genuine coordinate collision is settled by
 * `resolvePinCollisions` — which needs a clock, not a filter.
 */

import { useEffect, useMemo, useState } from 'react';
import { MAX_TIMEOUT_MS, nextWindowBoundaryAfter } from '../map/window';
import type { TimeWindow } from '../types/map';

/** Anything carrying opening hours. `RawMarkerData` fits. */
interface HasHours {
  hours: TimeWindow[];
}

export function useWindowClock(items: readonly HasHours[]): number {
  const [epoch, setEpoch] = useState(0);

  const hours = useMemo(() => items.flatMap((i) => i.hours), [items]);

  // `epoch` is a dependency so the effect re-arms after each firing. Without it
  // the first boundary would be the only one this ever observed.
  useEffect(() => {
    const now = Date.now();
    const next = nextWindowBoundaryAfter(hours, now);
    if (next === null) return;
    const delay = Math.min(Math.max(next - now, 0), MAX_TIMEOUT_MS);
    const timer = setTimeout(() => setEpoch((e) => e + 1), delay);
    return () => clearTimeout(timer);
  }, [hours, epoch]);

  return useMemo(
    () => Date.now(),
    // `epoch` is read by nothing in the body and that is deliberate: it exists
    // to invalidate this memo at a boundary, since `hours` is unchanged there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours, epoch],
  );
}
