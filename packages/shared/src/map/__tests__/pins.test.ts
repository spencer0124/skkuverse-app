/**
 * The coordinate-collision ladder.
 *
 * The ORDER of the four steps is what this suite exists to pin, and the west
 * strip is why. `daybooth-01` shares a point with two bars because it is the
 * same stall re-striped at dusk, so only "open right now" knows which of them
 * the map should be pointing at — with `pinPriority` first, the operations desk
 * would spend its whole 11:00–18:00 window hidden behind a bar that is shut,
 * because `bar` outranks `booth` on a number that cannot see the clock.
 *
 * Contract: skkuverse-server `docs/reference/map-markers-api.md` §3.4.
 */

import { describe, it, expect } from 'vitest';
import { resolvePinCollisions, type PinCandidate } from '../pins';

const NOON = Date.parse('2026-09-16T12:00:00.000Z');
const DUSK = Date.parse('2026-09-16T19:00:00.000Z');
const DAWN = Date.parse('2026-09-16T04:00:00.000Z');

const SPOT = { lat: 37.295473, lng: 126.971096 };
const ELSEWHERE = { lat: 37.294118, lng: 126.972004 };

const place = (over: Partial<PinCandidate> & { id: string }): PinCandidate => ({
  ...SPOT,
  hours: [],
  order: 0,
  pinPriority: 0,
  ...over,
});

const DAY = { startAt: '2026-09-16T11:00:00.000Z', endAt: '2026-09-16T15:00:00.000Z' };
const NIGHT = { startAt: '2026-09-16T18:00:00.000Z', endAt: '2026-09-17T00:00:00.000Z' };

const ids = (out: PinCandidate[]) => out.map((m) => m.id);

describe('resolvePinCollisions — step 1, openness outranks everything', () => {
  const booth = place({ id: 'daybooth-01', hours: [DAY], pinPriority: 10 });
  const bar = place({ id: 'bar-01', hours: [NIGHT], pinPriority: 30 });

  it('draws the day booth at noon even though the bar outranks it', () => {
    expect(ids(resolvePinCollisions([booth, bar], NOON))).toEqual(['daybooth-01']);
  });

  it('draws the bar at dusk', () => {
    expect(ids(resolvePinCollisions([booth, bar], DUSK))).toEqual(['bar-01']);
  });

  it('does not depend on input order', () => {
    expect(ids(resolvePinCollisions([bar, booth], NOON))).toEqual(['daybooth-01']);
  });
});

describe('resolvePinCollisions — step 2, pinPriority between two open places', () => {
  it('draws the stage over the 화장실', () => {
    const stage = place({ id: 'stage', hours: [DAY], pinPriority: 50 });
    const toilet = place({ id: 'toilet', hours: [], pinPriority: 5 });
    expect(ids(resolvePinCollisions([toilet, stage], NOON))).toEqual(['stage']);
  });

  it('treats an always-open place as open, so it can win on priority', () => {
    const toilet = place({ id: 'toilet', hours: [], pinPriority: 5 });
    const shutBar = place({ id: 'bar', hours: [NIGHT], pinPriority: 30 });
    expect(ids(resolvePinCollisions([shutBar, toilet], NOON))).toEqual(['toilet']);
  });
});

describe('resolvePinCollisions — step 3, next opening soonest', () => {
  // The ladder is LINEAR, so step 3 is reached only once step 2 has tied. That
  // is the numbered contract in map-markers-api §3.4, and it is worth stating
  // because the prose beside it ("step 3 covers the hours when nothing on that
  // spot is open") reads as though a closed pair skips priority entirely. It
  // does not: two closed places with different priorities are settled at step 2.
  it('does NOT jump over pinPriority for a closed pair', () => {
    const booth = place({ id: 'booth', hours: [DAY], pinPriority: 10 });
    const bar = place({ id: 'bar', hours: [NIGHT], pinPriority: 30 });
    // 04:00, both shut. The booth opens sooner, and the bar still wins on rank.
    expect(ids(resolvePinCollisions([bar, booth], DAWN))).toEqual(['bar']);
  });

  it('points the overnight map at whichever equal-rank stall opens first', () => {
    // Two bars sharing a plot: both `category: bar`, both priority 30, windows a
    // night apart. This is the case step 3 exists for.
    const tonight = place({ id: 'bar-a', hours: [NIGHT], pinPriority: 30 });
    const tomorrow = place({
      id: 'bar-b',
      hours: [{ startAt: '2026-09-17T18:00:00.000Z', endAt: '2026-09-18T00:00:00.000Z' }],
      pinPriority: 30,
    });
    expect(ids(resolvePinCollisions([tomorrow, tonight], DAWN))).toEqual(['bar-a']);
  });

  it('a place that never opens again loses to one that still will', () => {
    const finished = place({ id: 'finished', hours: [DAY] });
    const upcoming = place({
      id: 'upcoming',
      hours: [{ startAt: '2026-09-19T11:00:00.000Z', endAt: '2026-09-19T15:00:00.000Z' }],
    });
    const afterEverything = Date.parse('2026-09-18T00:00:00.000Z');
    expect(ids(resolvePinCollisions([finished, upcoming], afterEverything))).toEqual(['upcoming']);
  });
});

describe('resolvePinCollisions — step 4, a total order', () => {
  it('falls through to order, then id', () => {
    // A tie that reached input order would make the winner change between two
    // renders of the same data — a pin swapping identity under the user.
    const a = place({ id: 'a', order: 20 });
    const b = place({ id: 'b', order: 10 });
    expect(ids(resolvePinCollisions([a, b], NOON))).toEqual(['b']);

    const x = place({ id: 'x' });
    const y = place({ id: 'y' });
    expect(ids(resolvePinCollisions([y, x], NOON))).toEqual(['x']);
  });
});

describe('resolvePinCollisions — what it leaves alone', () => {
  it('keeps every place that has its coordinate to itself', () => {
    const here = place({ id: 'here' });
    const there = place({ id: 'there', ...ELSEWHERE });
    expect(ids(resolvePinCollisions([here, there], NOON))).toEqual(['here', 'there']);
  });

  it('preserves input order rather than the ladder order', () => {
    // The ladder ranks WITHIN a coordinate and says nothing across them.
    // Reordering the whole set by it would churn the marker tree at every
    // boundary for no visible gain.
    const first = place({ id: 'z-first', ...ELSEWHERE, order: 99 });
    const second = place({ id: 'a-second', order: 1 });
    expect(ids(resolvePinCollisions([first, second], NOON))).toEqual(['z-first', 'a-second']);
  });

  it('does not merge two points a genuine survey apart', () => {
    // The 2025 부스전 fix: two stalls surveyed as one interpolated point were
    // split by a quarter of the strip's step, ~1.3 m. Six decimals is ~11 cm, so
    // the key must keep them apart.
    const a = place({ id: 'a', lat: 37.295473, lng: 126.971096 });
    const b = place({ id: 'b', lat: 37.295485, lng: 126.971096 });
    expect(ids(resolvePinCollisions([a, b], NOON))).toEqual(['a', 'b']);
  });

  it('merges the same point arriving with float noise', () => {
    const a = place({ id: 'a', lat: 37.295473, lng: 126.971096 });
    const b = place({ id: 'b', lat: 37.2954730000001, lng: 126.971096 });
    expect(resolvePinCollisions([a, b], NOON)).toHaveLength(1);
  });

  it('is empty for an empty set', () => {
    expect(resolvePinCollisions([], NOON)).toEqual([]);
  });
});
