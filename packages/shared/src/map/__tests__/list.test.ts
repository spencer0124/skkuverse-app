/**
 * What the event list shows, and in what order.
 *
 * Both halves used to be the server's — the snapshot carried its own item set
 * and a `sorts` array declaring the orders on offer. Neither exists now, so
 * these are the client's rules and this suite is what keeps them honest.
 *
 * The asymmetry worth pinning: the list shows a place whose LAYER is drawn, and
 * says nothing about whether that place won its coordinate. A booth suppressed
 * by a bar at 19:00 is still open and still listed.
 */

import { describe, it, expect } from 'vitest';
import type { MapLayerDef, MapOverlay, MarkerOverlay } from '../../types/map';
import { PLACE_SORTS, selectVisibleOverlays, sortPlaces } from '../list';

const NOON = Date.parse('2026-09-16T12:00:00.000Z');
const DAY = { startAt: '2026-09-16T11:00:00.000Z', endAt: '2026-09-16T15:00:00.000Z' };
const NIGHT = { startAt: '2026-09-16T18:00:00.000Z', endAt: '2026-09-17T00:00:00.000Z' };
const LATER = { startAt: '2026-09-16T22:00:00.000Z', endAt: '2026-09-17T02:00:00.000Z' };

const layer = (over: Partial<MapLayerDef> & { id: string }): MapLayerDef => ({
  label: over.id,
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/map/overlays/event',
  chipGroupId: 'eskara-2026',
  userConfigurable: true,
  ...over,
});

// Typed on the MARKER arm rather than on `MapOverlay`: every place here has a
// coordinate, and `Partial` over a union cannot express "the marker one".
const place = (over: Partial<MarkerOverlay> & { id: string }): MarkerOverlay => ({
  kind: 'marker',
  layerId: 'eskara26_booth',
  lat: 37.29,
  lng: 126.97,
  campus: 'nsc',
  text: { ko: over.id, en: over.id },
  subtitle: null,
  hours: [],
  fields: [],
  actions: [],
  order: 0,
  pinPriority: 0,
  tap: { kind: 'event', placeId: over.id },
  ...over,
});

const ids = (out: readonly MapOverlay[]) => out.map((m) => m.id);

describe('selectVisibleOverlays', () => {
  const layers = [layer({ id: 'eskara26_booth' }), layer({ id: 'eskara26_bar' })];
  const markers = [
    place({ id: 'b1', layerId: 'eskara26_booth' }),
    place({ id: 'r1', layerId: 'eskara26_bar' }),
  ];
  /** Any instant works for `always` layers; the scheduled case names its own. */
  const NOW = Date.parse('2026-09-16T12:00:00+09:00');
  const state = (overrides: Record<string, boolean> = {}) => ({ overrides, chip: null });

  it('lists a place exactly when its layer is drawn', () => {
    const only = state({ eskara26_booth: true, eskara26_bar: false });
    expect(ids(selectVisibleOverlays({ markers, layers, state: only, now: NOW }))).toEqual(['b1']);
  });

  it("falls back to the layer's own schedule when the user has not touched it", () => {
    const hidden = [
      layer({ id: 'eskara26_booth' }),
      layer({ id: 'eskara26_bar', defaultVisibleWhen: { kind: 'never' } }),
    ];
    expect(
      ids(selectVisibleOverlays({ markers, layers: hidden, state: state(), now: NOW })),
    ).toEqual(['b1']);
  });

  it('follows a scheduled layer across its boundary', () => {
    // The list and the map read the same `isLayerVisible`, so a 주점 row appears
    // exactly when its pin does — which is the whole reason `now` is threaded in
    // rather than read from the clock here.
    const scheduled = [
      layer({
        id: 'eskara26_booth',
        defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '11:00', end: '18:00' }] },
      }),
      layer({
        id: 'eskara26_bar',
        defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '18:00', end: '00:00' }] },
      }),
    ];
    const noon = Date.parse('2026-09-16T12:00:00+09:00');
    const dusk = Date.parse('2026-09-16T19:00:00+09:00');
    expect(
      ids(selectVisibleOverlays({ markers, layers: scheduled, state: state(), now: noon })),
    ).toEqual(['b1']);
    expect(
      ids(selectVisibleOverlays({ markers, layers: scheduled, state: state(), now: dusk })),
    ).toEqual(['r1']);
  });

  it('drops a marker naming a layer this build was not served', () => {
    const orphan = [place({ id: 'ghost', layerId: 'eskara26_stage' })];
    expect(
      selectVisibleOverlays({ markers: orphan, layers, state: state(), now: NOW }),
    ).toEqual([]);
  });

  it('returns nothing when every layer is hidden', () => {
    const off = state({ eskara26_booth: false, eskara26_bar: false });
    expect(selectVisibleOverlays({ markers, layers, state: off, now: NOW })).toEqual([]);
  });

  it('preserves input order, so a sort applied upstream survives', () => {
    expect(ids(selectVisibleOverlays({ markers, layers, state: state(), now: NOW }))).toEqual([
      'b1',
      'r1',
    ]);
  });
});

describe('sortPlaces', () => {
  it('order: by the author\'s position, ascending', () => {
    const out = sortPlaces(
      [place({ id: 'c', order: 30 }), place({ id: 'a', order: 10 }), place({ id: 'b', order: 20 })],
      'order',
      'ko',
      NOON,
    );
    expect(ids(out)).toEqual(['a', 'b', 'c']);
  });

  it('title: by the string the CURRENT language renders', () => {
    const a = place({ id: 'a', text: { ko: '나', en: 'Zulu' } });
    const b = place({ id: 'b', text: { ko: '가', en: 'Alpha' } });
    expect(ids(sortPlaces([a, b], 'title', 'ko', NOON))).toEqual(['b', 'a']);
    expect(ids(sortPlaces([a, b], 'title', 'en', NOON))).toEqual(['b', 'a']);
    const c = place({ id: 'c', text: { ko: '가', en: 'Zulu' } });
    const d = place({ id: 'd', text: { ko: '나', en: 'Alpha' } });
    // Same pair, opposite answers — which is the point of sorting on the
    // rendered string rather than on `ko`.
    expect(ids(sortPlaces([c, d], 'title', 'ko', NOON))).toEqual(['c', 'd']);
    expect(ids(sortPlaces([c, d], 'title', 'en', NOON))).toEqual(['d', 'c']);
  });

  it('opening: open now first, then soonest, then never again', () => {
    const openNow = place({ id: 'open', hours: [DAY] });
    const soon = place({ id: 'soon', hours: [NIGHT] });
    const later = place({ id: 'later', hours: [LATER] });
    const done = place({ id: 'done', hours: [{ startAt: '2026-09-15T11:00:00.000Z', endAt: '2026-09-15T15:00:00.000Z' }] });
    expect(ids(sortPlaces([done, later, soon, openNow], 'opening', 'ko', NOON))).toEqual([
      'open',
      'soon',
      'later',
      'done',
    ]);
  });

  it('opening: an always-open place sorts with the open ones, not at the top of "soonest"', () => {
    const always = place({ id: 'toilet', hours: [] });
    const soon = place({ id: 'soon', hours: [NIGHT] });
    expect(ids(sortPlaces([soon, always], 'opening', 'ko', NOON))).toEqual(['toilet', 'soon']);
  });

  it('opening: two open places tie and fall through to id, not to input order', () => {
    // Both rank -Infinity. A subtracting comparator would produce NaN here,
    // which is neither 0 nor a sign, so the id fallthrough would never run and
    // the list would reshuffle at every clock boundary.
    const b = place({ id: 'b', hours: [DAY] });
    const a = place({ id: 'a', hours: [] });
    expect(ids(sortPlaces([b, a], 'opening', 'ko', NOON))).toEqual(['a', 'b']);
  });

  it('opening: two finished places tie the same way', () => {
    const past = { startAt: '2026-09-15T11:00:00.000Z', endAt: '2026-09-15T15:00:00.000Z' };
    const b = place({ id: 'b', hours: [past] });
    const a = place({ id: 'a', hours: [past] });
    expect(ids(sortPlaces([b, a], 'opening', 'ko', NOON))).toEqual(['a', 'b']);
  });

  it('never mutates its input', () => {
    const input = [place({ id: 'b', order: 2 }), place({ id: 'a', order: 1 })];
    sortPlaces(input, 'order', 'ko', NOON);
    expect(ids(input)).toEqual(['b', 'a']);
  });

  it('every offered sort is total', () => {
    // A tie anywhere makes the result depend on input order, and the input is
    // re-derived on every clock boundary.
    const pair = [place({ id: 'b' }), place({ id: 'a' })];
    for (const sort of PLACE_SORTS) {
      expect(ids(sortPlaces(pair, sort, 'ko', NOON))).toEqual(['a', 'b']);
    }
  });
});
