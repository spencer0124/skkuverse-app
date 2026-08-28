/**
 * Window visibility — the arithmetic that replaced the `status` field.
 *
 * The wire carries the WINDOW and nothing else, so both bounds null means
 * "always visible" and only that. `status` used to force that same pair to mean
 * two opposite things — an always-on facility and a cancelled booth — and a
 * cancellation is now expressed by the marker not being served at all.
 */

import { describe, it, expect } from 'vitest';
import {
  isWithinWindow,
  nextWindowBoundaryAfter,
  toEpochMs,
  MAX_TIMEOUT_MS,
} from '../window';

const T = (iso: string) => Date.parse(iso);
const NOON = T('2026-09-16T12:00:00.000Z');

describe('isWithinWindow', () => {
  it('draws a marker with both bounds null, at any time', () => {
    expect(isWithinWindow({ startAt: null, endAt: null }, NOON)).toBe(true);
    expect(isWithinWindow({ startAt: null, endAt: null }, 0)).toBe(true);
  });

  it('hides a marker before its start', () => {
    expect(
      isWithinWindow({ startAt: '2026-09-16T13:00:00.000Z', endAt: null }, NOON),
    ).toBe(false);
  });

  it('draws a marker at exactly its start — the window is half-open', () => {
    expect(
      isWithinWindow({ startAt: '2026-09-16T12:00:00.000Z', endAt: null }, NOON),
    ).toBe(true);
  });

  it('hides a marker at exactly its end, matching the server', () => {
    expect(
      isWithinWindow({ startAt: null, endAt: '2026-09-16T12:00:00.000Z' }, NOON),
    ).toBe(false);
  });

  it('draws a marker inside a two-sided window', () => {
    expect(
      isWithinWindow(
        { startAt: '2026-09-16T11:00:00.000Z', endAt: '2026-09-16T13:00:00.000Z' },
        NOON,
      ),
    ).toBe(true);
  });

  it('ignores an unparseable bound rather than hiding the marker forever', () => {
    // Every comparison against NaN is false, so a naive implementation would
    // fail both sides and the marker would never draw with nothing to explain it.
    expect(isWithinWindow({ startAt: 'soon', endAt: null }, NOON)).toBe(true);
  });

  it('is timezone-independent — an offset spelling of the same instant agrees', () => {
    // Bounds are absolute instants, so a phone set to Bangkok derives what a
    // phone set to Seoul does.
    const utc = { startAt: '2026-09-16T12:00:00.000Z', endAt: null };
    const kst = { startAt: '2026-09-16T21:00:00.000+09:00', endAt: null };
    expect(isWithinWindow(utc, NOON)).toBe(isWithinWindow(kst, NOON));
  });
});

describe('nextWindowBoundaryAfter', () => {
  it('finds the earliest instant strictly ahead', () => {
    const next = nextWindowBoundaryAfter(
      [
        { startAt: '2026-09-16T18:00:00.000Z', endAt: null },
        { startAt: null, endAt: '2026-09-16T14:00:00.000Z' },
      ],
      NOON,
    );
    expect(next).toBe(T('2026-09-16T14:00:00.000Z'));
  });

  it('ignores a boundary already in the past', () => {
    expect(
      nextWindowBoundaryAfter([{ startAt: '2026-09-16T06:00:00.000Z', endAt: null }], NOON),
    ).toBeNull();
  });

  it('ignores a boundary exactly at now, which has already been applied', () => {
    expect(
      nextWindowBoundaryAfter([{ startAt: '2026-09-16T12:00:00.000Z', endAt: null }], NOON),
    ).toBeNull();
  });

  it('skips the always-on markers entirely — both null is not a boundary', () => {
    expect(nextWindowBoundaryAfter([{ startAt: null, endAt: null }], NOON)).toBeNull();
  });

  it('returns null for an empty list, so the caller arms no timer', () => {
    expect(nextWindowBoundaryAfter([], NOON)).toBeNull();
  });

  it('takes an end bound as readily as a start bound', () => {
    const next = nextWindowBoundaryAfter(
      [{ startAt: '2026-09-16T09:00:00.000Z', endAt: '2026-09-16T13:00:00.000Z' }],
      NOON,
    );
    expect(next).toBe(T('2026-09-16T13:00:00.000Z'));
  });
});

describe('toEpochMs and the timer clamp', () => {
  it('answers null for absent and unparseable values alike', () => {
    expect(toEpochMs(null)).toBeNull();
    expect(toEpochMs(undefined)).toBeNull();
    expect(toEpochMs('not a date')).toBeNull();
  });

  it('clamps below the signed 32-bit setTimeout ceiling', () => {
    // A delay past this overflows and fires IMMEDIATELY, turning a far-future
    // boundary into a re-render hot loop. The constant is the ceiling itself.
    expect(MAX_TIMEOUT_MS).toBe(2 ** 31 - 1);
  });
});
