/**
 * Status derivation is the correctness core of the event map. These tests pin
 * the two rules that make it safe to run against the device's own clock: null
 * bounds mean "do not recompute", and bounds are absolute instants rather than
 * wall-clock strings, so the device's timezone cannot change the answer.
 */

import { describe, it, expect } from 'vitest';
import { deriveItemStatus, nextBoundaryAfter } from '../clock';
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

  it('handles a bar running past midnight KST, because bounds are instants', () => {
    // 22:00 KST day 1 → 02:00 KST day 2, the shape the server materializes for a
    // 주점: the stored civil day stays day 1 while endAt lands on day 2.
    const i = item({
      startAt: '2026-09-16T13:00:00.000Z', // 22:00 KST
      endAt: '2026-09-16T17:00:00.000Z', // 02:00 KST, the next civil day
    });
    expect(deriveItemStatus(i, Date.parse('2026-09-16T12:59:00.000Z'))).toBe('upcoming');
    expect(deriveItemStatus(i, Date.parse('2026-09-16T15:30:00.000Z'))).toBe('open'); // 00:30 KST
    expect(deriveItemStatus(i, Date.parse('2026-09-16T17:00:00.000Z'))).toBe('closed');
  });

  it('reads a bound identically however its offset is written', () => {
    // What the timezone-independence claim actually rests on: the bound is an
    // instant, so `+09:00` and the equivalent `Z` are the same moment and the
    // device's own zone never enters the comparison.
    const kstNotation = item({
      startAt: '2026-09-16T22:00:00+09:00',
      endAt: '2026-09-17T02:00:00+09:00',
    });
    const utcNotation = item({
      startAt: '2026-09-16T13:00:00.000Z',
      endAt: '2026-09-16T17:00:00.000Z',
    });
    const justBefore = Date.parse('2026-09-16T12:59:00.000Z');
    const justAfter = Date.parse('2026-09-16T13:01:00.000Z');
    expect(deriveItemStatus(kstNotation, justBefore)).toBe('upcoming');
    expect(deriveItemStatus(utcNotation, justBefore)).toBe('upcoming');
    expect(deriveItemStatus(kstNotation, justAfter)).toBe('open');
    expect(deriveItemStatus(utcNotation, justAfter)).toBe('open');
  });

  it('overrides a stale shipped status for a session already underway', () => {
    // The snapshot is immutable, so `status` is only ever as of materializedAt.
    // A session that has since opened must read open however long it has run.
    const i = item({
      status: 'upcoming',
      startAt: new Date(T0).toISOString(),
      endAt: new Date(T0 + 4 * HOUR).toISOString(),
    });
    expect(deriveItemStatus(i, T0 + HOUR)).toBe('open');
    expect(deriveItemStatus(i, T0 + 3 * HOUR)).toBe('open');
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
