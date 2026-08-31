/**
 * The wall-clock engine behind a layer's `defaultVisibleWhen`.
 *
 * Three properties are load-bearing and each has its own block below:
 *
 *  1. The KST minute comes from the EPOCH. Every fixture here is written with an
 *     explicit offset so it means one instant on any machine, and one case
 *     asserts that the same instant spelled `Z` and spelled `+09:00` agrees —
 *     which is the property that lets a phone set to New York still flip 주점 on
 *     at 18:00 KST.
 *  2. `start > end` wraps past midnight, so a bar's 18:00–00:00 needs no special
 *     case anywhere else.
 *  3. `nextDailyBoundaryAfter` never returns a value at or before `now`. A zero
 *     delay fires immediately, re-arms at the same boundary and spins.
 */

import { describe, it, expect } from 'vitest';
import {
  isDailyWindowOpen,
  kstMinutesOfDay,
  nextDailyBoundaryAfter,
  toMinutesOfDay,
} from '../daily-window';

const at = (iso: string) => Date.parse(iso);

const DAY = { start: '11:00', end: '18:00' };
/** Crosses midnight. The 주점 window, verbatim from the live config. */
const NIGHT = { start: '18:00', end: '00:00' };

describe('kstMinutesOfDay — derived from the epoch, never from the device', () => {
  it('reads a KST wall-clock time back as its own minute', () => {
    expect(kstMinutesOfDay(at('2026-08-28T00:00:00+09:00'))).toBe(0);
    expect(kstMinutesOfDay(at('2026-08-28T11:00:00+09:00'))).toBe(11 * 60);
    expect(kstMinutesOfDay(at('2026-08-28T12:34:00+09:00'))).toBe(12 * 60 + 34);
    expect(kstMinutesOfDay(at('2026-08-28T23:59:00+09:00'))).toBe(1439);
  });

  it('reads an instant, not a wall clock', () => {
    // 03:00 UTC IS 12:00 KST. If this ever disagreed, the implementation would
    // have reached for the device's local hour instead of the epoch.
    expect(kstMinutesOfDay(at('2026-08-28T03:00:00Z'))).toBe(
      kstMinutesOfDay(at('2026-08-28T12:00:00+09:00')),
    );
    expect(kstMinutesOfDay(at('2026-08-27T22:00:00-05:00'))).toBe(
      kstMinutesOfDay(at('2026-08-28T12:00:00+09:00')),
    );
  });

  it('stays in range for an instant before the epoch', () => {
    // Total rather than merely correct for realistic input: a device with a
    // wildly wrong clock must not produce a negative minute that then reads as
    // "before every window".
    const minutes = kstMinutesOfDay(at('1969-07-20T20:17:00Z'));
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThan(1440);
  });
});

describe('toMinutesOfDay — one spelling of an hour', () => {
  it('accepts a zero-padded 24-hour time', () => {
    expect(toMinutesOfDay('00:00')).toBe(0);
    expect(toMinutesOfDay('09:05')).toBe(545);
    expect(toMinutesOfDay('23:59')).toBe(1439);
  });

  it('rejects everything else, including the second spelling of midnight', () => {
    // "24:00" is the one worth naming: it is a real ISO-8601 time and it would
    // give midnight a second spelling. The server rejects it too.
    for (const bad of ['24:00', '7:00', '25:00', '12:60', '1200', '12:0', '', 'noon']) {
      expect(toMinutesOfDay(bad)).toBeNull();
    }
  });
});

describe('isDailyWindowOpen — half-open, and wrapping when it must', () => {
  it('is open inside an ordinary window and shut outside it', () => {
    expect(isDailyWindowOpen(DAY, 12 * 60)).toBe(true);
    expect(isDailyWindowOpen(DAY, 9 * 60)).toBe(false);
    expect(isDailyWindowOpen(DAY, 19 * 60)).toBe(false);
  });

  it('includes the start and excludes the end', () => {
    expect(isDailyWindowOpen(DAY, 11 * 60)).toBe(true);
    expect(isDailyWindowOpen(DAY, 18 * 60)).toBe(false);
  });

  it('wraps past midnight when start > end', () => {
    expect(isDailyWindowOpen(NIGHT, 19 * 60)).toBe(true);
    expect(isDailyWindowOpen(NIGHT, 23 * 60 + 59)).toBe(true);
    // Midnight itself is the exclusive end, so 주점 is shut at 00:00 exactly.
    expect(isDailyWindowOpen(NIGHT, 0)).toBe(false);
    expect(isDailyWindowOpen(NIGHT, 12 * 60)).toBe(false);
  });

  it('keeps the small hours open for a window that runs into them', () => {
    const lateBar = { start: '18:00', end: '02:00' };
    expect(isDailyWindowOpen(lateBar, 60)).toBe(true);
    expect(isDailyWindowOpen(lateBar, 2 * 60)).toBe(false);
    expect(isDailyWindowOpen(lateBar, 12 * 60)).toBe(false);
  });

  it('reads an unparseable bound as shut', () => {
    // Fail closed here too, for the same reason `null` does: an hour we cannot
    // read must not become a layer drawn all day.
    expect(isDailyWindowOpen({ start: '18:00', end: '24:00' }, 20 * 60)).toBe(false);
    expect(isDailyWindowOpen({ start: 'x', end: '18:00' }, 12 * 60)).toBe(false);
  });
});

describe('nextDailyBoundaryAfter — what the timer is armed at', () => {
  it('picks the soonest edge still ahead', () => {
    const noon = at('2026-08-28T12:00:00+09:00');
    expect(nextDailyBoundaryAfter([DAY], noon)).toBe(at('2026-08-28T18:00:00+09:00'));
  });

  it('rolls to tomorrow once every edge has passed', () => {
    const evening = at('2026-08-28T19:00:00+09:00');
    expect(nextDailyBoundaryAfter([DAY], evening)).toBe(at('2026-08-29T11:00:00+09:00'));
  });

  it('never returns the boundary it is standing on', () => {
    // The hot-loop guard. At exactly 18:00 the 18:00 edge is BEHIND, so the
    // answer is tomorrow's 11:00 — not a zero delay that fires and re-arms here
    // forever.
    const sharp = at('2026-08-28T18:00:00+09:00');
    const next = nextDailyBoundaryAfter([DAY], sharp);
    expect(next).toBe(at('2026-08-29T11:00:00+09:00'));
    expect(next!).toBeGreaterThan(sharp);
  });

  it('takes the earliest across several windows', () => {
    const noon = at('2026-08-28T12:00:00+09:00');
    // 부스 closes at 18:00 and 주점 opens at 18:00 — the same edge — while the
    // next one after that is midnight.
    expect(nextDailyBoundaryAfter([DAY, NIGHT], noon)).toBe(
      at('2026-08-28T18:00:00+09:00'),
    );
    expect(nextDailyBoundaryAfter([DAY, NIGHT], at('2026-08-28T20:00:00+09:00'))).toBe(
      at('2026-08-29T00:00:00+09:00'),
    );
  });

  it('returns null when there is nothing to wait for', () => {
    expect(nextDailyBoundaryAfter([], at('2026-08-28T12:00:00+09:00'))).toBeNull();
    expect(
      nextDailyBoundaryAfter([{ start: 'x', end: 'y' }], at('2026-08-28T12:00:00+09:00')),
    ).toBeNull();
  });

  it('never asks for a delay longer than a day', () => {
    const noon = at('2026-08-28T12:00:00+09:00');
    const next = nextDailyBoundaryAfter([DAY, NIGHT], noon)!;
    expect(next - noon).toBeGreaterThan(0);
    expect(next - noon).toBeLessThanOrEqual(86_400_000);
  });
});
