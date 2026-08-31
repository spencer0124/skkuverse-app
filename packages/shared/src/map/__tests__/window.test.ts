/**
 * Opening hours against the device clock.
 *
 * The rule this suite exists to pin, restated from map-markers-api §3:
 *
 * ```text
 * hours.length === 0 || hours.some(w => now >= w.startAt && now < w.endAt)
 * ```
 *
 * The empty-list case is the one worth a test of its own. It replaced a
 * both-bounds-null pair that had to mean an always-on 화장실 AND a
 * rain-cancelled bar depending on a sibling `status` field — which is exactly
 * why `status` was load-bearing rather than redundant, and why it is gone.
 */

import { describe, it, expect } from 'vitest';
import { isOpenNow, nextOpeningAfter, nextWindowBoundaryAfter, toEpochMs } from '../window';

const NOON = Date.parse('2026-09-16T12:00:00.000Z');
const w = (startAt: string, endAt: string) => ({ startAt, endAt });

describe('isOpenNow', () => {
  it('treats an empty list as always open, and only that', () => {
    expect(isOpenNow([], NOON)).toBe(true);
    expect(isOpenNow([], 0)).toBe(true);
  });

  it('is open inside a window', () => {
    expect(isOpenNow([w('2026-09-16T11:00:00.000Z', '2026-09-16T13:00:00.000Z')], NOON)).toBe(true);
  });

  it('is shut before the first window opens', () => {
    expect(isOpenNow([w('2026-09-16T13:00:00.000Z', '2026-09-16T14:00:00.000Z')], NOON)).toBe(false);
  });

  it('is open at the exact start and shut at the exact end — half-open [start, end)', () => {
    expect(isOpenNow([w('2026-09-16T12:00:00.000Z', '2026-09-16T13:00:00.000Z')], NOON)).toBe(true);
    expect(isOpenNow([w('2026-09-16T11:00:00.000Z', '2026-09-16T12:00:00.000Z')], NOON)).toBe(false);
  });

  it('is open when ANY window covers now, not only the first', () => {
    // The day-2 booth. With one window per document this had to be two
    // documents, which is what put every place in the list twice.
    const hours = [
      w('2026-09-15T11:00:00.000Z', '2026-09-15T15:00:00.000Z'),
      w('2026-09-16T11:00:00.000Z', '2026-09-16T15:00:00.000Z'),
    ];
    expect(isOpenNow(hours, NOON)).toBe(true);
  });

  it('reads an instant, not a wall clock — a device in the wrong timezone still agrees', () => {
    const utc = [w('2026-09-16T11:00:00.000Z', '2026-09-16T13:00:00.000Z')];
    const kst = [w('2026-09-16T20:00:00.000+09:00', '2026-09-16T22:00:00.000+09:00')];
    expect(isOpenNow(utc, NOON)).toBe(isOpenNow(kst, NOON));
  });
});

describe('nextOpeningAfter', () => {
  it('finds the soonest future start', () => {
    const hours = [
      w('2026-09-16T18:00:00.000Z', '2026-09-16T22:00:00.000Z'),
      w('2026-09-16T14:00:00.000Z', '2026-09-16T16:00:00.000Z'),
    ];
    expect(nextOpeningAfter(hours, NOON)).toBe(Date.parse('2026-09-16T14:00:00.000Z'));
  });

  it('ignores a window that has already started', () => {
    expect(
      nextOpeningAfter([w('2026-09-16T06:00:00.000Z', '2026-09-16T20:00:00.000Z')], NOON),
    ).toBeNull();
  });

  it('returns null for an always-open place', () => {
    // Not "opens at the beginning of time": it is already open, so step 1 of the
    // collision ladder has answered and this is never the question being asked.
    expect(nextOpeningAfter([], NOON)).toBeNull();
  });
});

describe('nextWindowBoundaryAfter', () => {
  it('takes the earliest of every future open and close', () => {
    const hours = [
      w('2026-09-16T18:00:00.000Z', '2026-09-16T22:00:00.000Z'),
      w('2026-09-16T06:00:00.000Z', '2026-09-16T14:00:00.000Z'),
    ];
    expect(nextWindowBoundaryAfter(hours, NOON)).toBe(Date.parse('2026-09-16T14:00:00.000Z'));
  });

  it('ignores boundaries at or before now, so a fired timer cannot re-arm at zero', () => {
    expect(
      nextWindowBoundaryAfter([w('2026-09-16T06:00:00.000Z', '2026-09-16T12:00:00.000Z')], NOON),
    ).toBeNull();
  });

  it('returns null for an always-open place, which has no boundary to arm at', () => {
    expect(nextWindowBoundaryAfter([], NOON)).toBeNull();
  });
});

describe('toEpochMs', () => {
  it('returns null rather than NaN for an unparseable instant', () => {
    expect(toEpochMs('soon')).toBeNull();
    expect(toEpochMs(null)).toBeNull();
    expect(toEpochMs(undefined)).toBeNull();
  });
});
