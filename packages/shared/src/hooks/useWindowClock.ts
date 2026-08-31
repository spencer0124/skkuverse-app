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
 * windows. A MARKER's hours still do not decide what is drawn (map-markers-api
 * §3.3): the pin filtering they used to drive was how the old map coped with a
 * crowded field, which was a workaround for the day-split rather than a feature.
 * A genuine coordinate collision is settled by `resolvePinCollisions` — which
 * needs a clock, not a filter.
 *
 * A LAYER's `defaultVisibleWhen` is the exception, on the other axis, and it is
 * why this hook takes a second argument. Those boundaries have to be armed here
 * because a layer that is currently hidden is not mounted and arms no timer of
 * its own: without them, 18:00 arrives and nothing in the app is waiting for it,
 * so 주점 appears whenever some unrelated re-render happens to occur.
 */

import { useEffect, useMemo, useState } from 'react';
import { nextDailyBoundaryAfter } from '../map/daily-window';
import { MAX_TIMEOUT_MS, nextWindowBoundaryAfter } from '../map/window';
import type { DailyWindow, TimeWindow } from '../types/map';

/** Anything carrying opening hours. Every `MapOverlay` fits. */
interface HasHours {
  hours: TimeWindow[];
}

/**
 * A stable identity for "no daily windows".
 *
 * Module-level rather than a `= []` default parameter, which would mint a fresh
 * array on every render and invalidate both memos below every time — turning the
 * one-shot timer into a re-arm on each render.
 */
const NO_DAILY_WINDOWS: readonly DailyWindow[] = [];

/** The sooner of two boundaries, either of which may be absent. */
function earliest(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

export function useWindowClock(
  items: readonly HasHours[],
  dailyWindows: readonly DailyWindow[] = NO_DAILY_WINDOWS,
): number {
  const [epoch, setEpoch] = useState(0);

  const hours = useMemo(() => items.flatMap((i) => i.hours), [items]);

  // `epoch` is a dependency so the effect re-arms after each firing. Without it
  // the first boundary would be the only one this ever observed.
  useEffect(() => {
    const now = Date.now();
    const next = earliest(
      nextWindowBoundaryAfter(hours, now),
      nextDailyBoundaryAfter(dailyWindows, now),
    );
    if (next === null) return;
    const delay = Math.min(Math.max(next - now, 0), MAX_TIMEOUT_MS);
    const timer = setTimeout(() => setEpoch((e) => e + 1), delay);
    return () => clearTimeout(timer);
  }, [hours, dailyWindows, epoch]);

  return useMemo(
    () => Date.now(),
    // `epoch` is read by nothing in the body and that is deliberate: it exists
    // to invalidate this memo at a boundary, since the windows are unchanged
    // there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours, dailyWindows, epoch],
  );
}
