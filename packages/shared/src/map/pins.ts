/**
 * One pin per coordinate: which marker is drawn when several share a spot.
 *
 * The server drops, merges and clock-filters nothing. It ships every place of
 * the live set with everything needed to disambiguate, and this is the client
 * half of that bargain — skkuverse-server `docs/reference/map-markers-api.md`
 * §3.4, reproduced here as the pure function the rule deserves.
 *
 * ## Why a coordinate is shared at all
 *
 * For exactly one reason on this map: a spot is used by different occupants at
 * different times. The west strip is booths from 11:00 and bars from 18:00, and
 * a day booth shares its point with two bars precisely because it is the same
 * stall re-striped at dusk.
 *
 * ## The ladder, and why openness comes first
 *
 * 1. **open right now**
 * 2. tie → highest `pinPriority`
 * 3. tie → next opening soonest
 * 4. tie → lowest `order`, then `id`
 *
 * Only step 1 knows about the re-striping. With `pinPriority` first the
 * operations desk would spend its entire 11:00–18:00 window hidden behind a bar
 * that is shut, because `bar` outranks `booth` on a number that cannot see the
 * clock. `pinPriority` still decides between two places open at once — a stage
 * over a 화장실 — which is the question it was always answering. Step 3 then
 * covers the hours when nothing on that spot is open: the pin becomes whichever
 * occupant is next, so an overnight map still points at the right stall.
 *
 * **A suppressed marker keeps its list row.** This decides pins and nothing
 * else; the list is `selectVisibleItems`'s answer and it lists every place.
 *
 * ## What this must NOT be applied to
 *
 * The two building layers draw the same building twice on purpose — a number
 * and a name at one coordinate — and they arrive in one response carrying the
 * same `id`. Running the ladder over them is a total tie that suppresses one of
 * the two at random. The caller scopes this to the festival layers, which is
 * what `isFestivalLayer` is for.
 */

import { isOpenNow, nextOpeningAfter } from './window';
import type { TimeWindow } from '../types/map';

/** The minimum the ladder needs. `RawMarkerData` satisfies it. */
export interface PinCandidate {
  id: string;
  lat: number;
  lng: number;
  hours: TimeWindow[];
  order: number;
  pinPriority: number;
}

/**
 * Six decimal places is about 11 cm.
 *
 * Far finer than the ~1.3 m a genuine two-stall split is surveyed at, so two
 * places meant to be distinct never merge here; far coarser than float noise, so
 * two places meant to be the same spot never miss each other. A raw
 * `${lat},${lng}` would do the latter badly — the same point can arrive as
 * 37.295473 and 37.29547300000001 through a JSON round trip.
 */
function coordKey(m: PinCandidate): string {
  return `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`;
}

/**
 * Is `a` the better pin than `b` at `now`?
 *
 * A total order, which matters more than it looks: a tie makes the winner depend
 * on input order, and the input is re-derived on every clock boundary — so a tie
 * is a pin that swaps identity underneath a user who is looking at it. `order`
 * then `id` closes it.
 */
function beats(a: PinCandidate, b: PinCandidate, now: number): boolean {
  const aOpen = isOpenNow(a.hours, now);
  const bOpen = isOpenNow(b.hours, now);
  if (aOpen !== bOpen) return aOpen;

  if (a.pinPriority !== b.pinPriority) return a.pinPriority > b.pinPriority;

  // `null` means "never opens again", which loses to any real instant. Two
  // nulls fall through, as do two equal instants.
  const aNext = nextOpeningAfter(a.hours, now);
  const bNext = nextOpeningAfter(b.hours, now);
  if (aNext !== bNext) {
    if (aNext === null) return false;
    if (bNext === null) return true;
    return aNext < bNext;
  }

  if (a.order !== b.order) return a.order < b.order;
  return a.id < b.id;
}

/**
 * The markers that are actually drawn: one per coordinate, in input order.
 *
 * Input order is preserved rather than the ladder's, because the ladder ranks
 * within a coordinate and says nothing across them — reordering the whole set by
 * it would churn the marker tree on every boundary for no visible gain.
 */
export function resolvePinCollisions<T extends PinCandidate>(
  markers: readonly T[],
  now: number,
): T[] {
  const winners = new Map<string, T>();
  for (const m of markers) {
    const key = coordKey(m);
    const held = winners.get(key);
    if (held === undefined || beats(m, held, now)) winners.set(key, m);
  }
  // Identity, not id: `id` is only unique WITHIN a layer, and this set can span
  // several. Two markers can legitimately share one.
  const drawn = new Set<T>(winners.values());
  return markers.filter((m) => drawn.has(m));
}
