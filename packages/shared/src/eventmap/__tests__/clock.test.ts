/**
 * The clock is the correctness core of the event map, and the two obvious
 * designs are both wrong. These tests pin the reasons.
 *
 * 1. Skew must come from the MANIFEST response, never the snapshot. The snapshot
 *    is `immutable, max-age=1y`, so a cached copy replays the origin's original
 *    `Date` (RFC 9111 §5.1) and the offset lands a day out.
 * 2. Skew must be APPLIED, not used as a discard threshold. Discarding above an
 *    hour abandons exactly the device that needed correcting and leaves it
 *    frozen at the shipped status — the same symptom the recompute exists to
 *    prevent.
 */

import { describe, it, expect } from 'vitest';
import {
  computeOffset,
  deriveItemStatus,
  nextBoundaryAfter,
  readUsableOffset,
  serverNow,
  MAX_PLAUSIBLE_OFFSET_MS,
  OFFSET_MAX_AGE_MS,
} from '../clock';
import type { EventMapItem } from '../../types/eventmap';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-09-16T03:00:00.000Z');

const item = (over: Partial<EventMapItem> = {}): EventMapItem =>
  ({
    id: 'i1',
    placeId: 'p1',
    stackKey: 'p1',
    lat: 37.29,
    lng: 126.97,
    title: 'T',
    subtitle: null,
    tags: [],
    status: 'unknown',
    startAt: null,
    endAt: null,
    hoursLabel: null,
    iconId: 'generic',
    iconIdClosed: null,
    pinPriority: 0,
    cardTemplateId: 'booth',
    order: 0,
    media: { thumbnailUrl: null, images: [] },
    fields: {},
    actions: [],
    ...over,
  }) as EventMapItem;

describe('computeOffset — where the skew may be measured', () => {
  it('measures the offset from a fresh response', () => {
    expect(computeOffset(T0 + 5_000, null, T0)).toBe(5_000);
  });

  it('refuses a response served from a cache, whose Date is a fossil', () => {
    // The single most likely silent failure: a day-old snapshot replays a day-old
    // Date, which would read as a 24h clock error rather than a cache hit.
    expect(computeOffset(T0 - 24 * HOUR, 86_400, T0)).toBe(0);
    expect(computeOffset(T0 + 5_000, 1, T0)).toBe(0);
  });

  it('accepts Age: 0, which is a fresh origin response', () => {
    expect(computeOffset(T0 + 5_000, 0, T0)).toBe(5_000);
  });

  it('falls back to trusting the device when there is no Date header', () => {
    // A CORS-restricted or proxy-stripped Date leaves no signal, and the device
    // clock is the best estimate available.
    expect(computeOffset(null, null, T0)).toBe(0);
  });

  it('rejects an implausible offset as nonsense rather than as clock error', () => {
    expect(computeOffset(T0 + MAX_PLAUSIBLE_OFFSET_MS + 1, null, T0)).toBe(0);
    expect(computeOffset(T0 - MAX_PLAUSIBLE_OFFSET_MS - 1, null, T0)).toBe(0);
  });

  it('keeps a large but plausible offset — this is the whole point', () => {
    // A device three hours out is exactly the one that needs correcting. The old
    // design discarded here and froze it at the shipped status.
    expect(computeOffset(T0 + 3 * HOUR, null, T0)).toBe(3 * HOUR);
  });

  it('rejects an unparseable Date', () => {
    expect(computeOffset(NaN, null, T0)).toBe(0);
  });
});

describe('readUsableOffset — a stored offset can go stale', () => {
  it('uses a recently measured offset', () => {
    expect(readUsableOffset({ offsetMs: 3 * HOUR, measuredAt: T0 }, T0 + HOUR)).toBe(3 * HOUR);
  });

  it('discards one older than the max age, since NTP may have corrected the clock', () => {
    expect(
      readUsableOffset({ offsetMs: 3 * HOUR, measuredAt: T0 }, T0 + OFFSET_MAX_AGE_MS + 1),
    ).toBe(0);
  });

  it('discards an implausible stored value', () => {
    expect(
      readUsableOffset({ offsetMs: MAX_PLAUSIBLE_OFFSET_MS + 1, measuredAt: T0 }, T0),
    ).toBe(0);
  });

  it('returns 0 when nothing is stored', () => {
    expect(readUsableOffset(null, T0)).toBe(0);
  });
});

describe('serverNow', () => {
  it('shifts the device clock by the offset', () => {
    const before = Date.now();
    const got = serverNow(3 * HOUR);
    expect(got).toBeGreaterThanOrEqual(before + 3 * HOUR);
  });
});

describe('deriveItemStatus', () => {
  it('trusts the shipped status when both bounds are null', () => {
    // The server's only lever for "do not recompute" — it pulls it for cancelled
    // sessions. Recomputing would reopen a rain-cancelled bar at its start time.
    expect(deriveItemStatus(item({ status: 'closed' }), T0 + 10 * HOUR)).toBe('closed');
    expect(deriveItemStatus(item({ status: 'open' }), T0)).toBe('open');
  });

  it('reads upcoming before startAt', () => {
    const i = item({ startAt: new Date(T0).toISOString(), endAt: new Date(T0 + 4 * HOUR).toISOString() });
    expect(deriveItemStatus(i, T0 - 1)).toBe('upcoming');
  });

  it('reads open at exactly startAt — the window is half-open', () => {
    const i = item({ startAt: new Date(T0).toISOString(), endAt: new Date(T0 + 4 * HOUR).toISOString() });
    expect(deriveItemStatus(i, T0)).toBe('open');
  });

  it('reads closed at exactly endAt, matching the server', () => {
    const i = item({ startAt: new Date(T0).toISOString(), endAt: new Date(T0 + 4 * HOUR).toISOString() });
    expect(deriveItemStatus(i, T0 + 4 * HOUR)).toBe('closed');
  });

  it('handles a bar running past midnight, because bounds are instants not clock strings', () => {
    const i = item({
      startAt: new Date(T0).toISOString(),
      endAt: new Date(T0 + 8 * HOUR).toISOString(),
    });
    expect(deriveItemStatus(i, T0 + 7 * HOUR)).toBe('open');
  });

  it('still derives for a long-running session once the offset is applied', () => {
    // The regression the old doc formula caused: it compared a moving deviceNow
    // against a fixed server instant, so any session open over an hour crossed
    // the tolerance and froze. Nothing here can freeze — there is no tolerance
    // branch left in derivation at all.
    const i = item({
      status: 'upcoming',
      startAt: new Date(T0).toISOString(),
      endAt: new Date(T0 + 4 * HOUR).toISOString(),
    });
    const deviceThreeHoursFast = T0 + HOUR; // corrected server time
    expect(deriveItemStatus(i, deviceThreeHoursFast)).toBe('open');
  });

  it('treats an unparseable instant as absent', () => {
    expect(deriveItemStatus(item({ status: 'open', startAt: 'not-a-date' }), T0)).toBe('open');
  });

  it('handles a one-sided window', () => {
    expect(deriveItemStatus(item({ endAt: new Date(T0).toISOString() }), T0 + 1)).toBe('closed');
    expect(deriveItemStatus(item({ startAt: new Date(T0).toISOString() }), T0 + 1)).toBe('open');
  });
});

describe('nextBoundaryAfter — the offline timer source', () => {
  const items = [
    item({ id: 'a', startAt: new Date(T0 + HOUR).toISOString(), endAt: new Date(T0 + 5 * HOUR).toISOString() }),
    item({ id: 'b', startAt: new Date(T0 + 2 * HOUR).toISOString(), endAt: new Date(T0 + 3 * HOUR).toISOString() }),
  ];

  it('returns the earliest instant strictly after now', () => {
    expect(nextBoundaryAfter(items, T0)).toBe(T0 + HOUR);
  });

  it('is strict — a boundary exactly at now has already fired', () => {
    expect(nextBoundaryAfter(items, T0 + HOUR)).toBe(T0 + 2 * HOUR);
  });

  it('crosses from one item to another as the evening progresses', () => {
    expect(nextBoundaryAfter(items, T0 + 2 * HOUR)).toBe(T0 + 3 * HOUR);
    expect(nextBoundaryAfter(items, T0 + 3 * HOUR)).toBe(T0 + 5 * HOUR);
  });

  it('returns null once every boundary is past, so no timer is armed', () => {
    expect(nextBoundaryAfter(items, T0 + 100 * HOUR)).toBeNull();
  });

  it('ignores do-not-recompute items, as the server does for its own nextChangeAt', () => {
    expect(nextBoundaryAfter([item({ status: 'closed' })], T0)).toBeNull();
  });

  it('returns null for an empty snapshot', () => {
    expect(nextBoundaryAfter([], T0)).toBeNull();
  });
});
