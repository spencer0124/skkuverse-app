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
import type { MapChipList, MapLayerDef, MapOverlay, MarkerOverlay } from '../../types/map';
import {
  defaultFacetSelection,
  filterByFacets,
  selectVisibleOverlays,
  sortForList,
  sortPlaces,
} from '../list';

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
  facets: {},
  orderByOption: {},
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

  it('skips an inert overlay: a label with nowhere to go gets no row', () => {
    const withLabel = [...markers, place({ id: 'b1-label', layerId: 'eskara26_booth', tap: null })];
    expect(ids(selectVisibleOverlays({ markers: withLabel, layers, state: state(), now: NOW }))).toEqual([
      'b1',
      'r1',
    ]);
  });

  it('preserves input order, so a sort applied upstream survives', () => {
    expect(ids(selectVisibleOverlays({ markers, layers, state: state(), now: NOW }))).toEqual([
      'b1',
      'r1',
    ]);
  });
});

describe('sortPlaces', () => {
  it("by the author's position, ascending", () => {
    const out = sortPlaces([
      place({ id: 'c', order: 30 }),
      place({ id: 'a', order: 10 }),
      place({ id: 'b', order: 20 }),
    ]);
    expect(ids(out)).toEqual(['a', 'b', 'c']);
  });

  it('never mutates its input', () => {
    const input = [place({ id: 'b', order: 2 }), place({ id: 'a', order: 1 })];
    sortPlaces(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });

  it('is total: an order tie falls through to id, not to input order', () => {
    // A tie anywhere makes the result depend on input order, and the input is
    // re-derived on every clock boundary.
    expect(ids(sortPlaces([place({ id: 'b' }), place({ id: 'a' })]))).toEqual(['a', 'b']);
  });
});

describe("a chip's list — the server decides, the app matches ids", () => {
  const LIST: MapChipList = {
    facets: [
      {
        id: 'day',
        label: '일자',
        select: 'required',
        options: [
          { id: 'day1', label: '1일차', window: { startAt: '2026-09-30T21:00:00.000Z', endAt: '2026-10-01T21:00:00.000Z' } },
          { id: 'day2', label: '2일차', window: { startAt: '2026-10-01T21:00:00.000Z', endAt: '2026-10-02T21:00:00.000Z' } },
        ],
      },
      {
        id: 'org',
        label: '운영',
        select: 'optional',
        options: [
          { id: 'council', label: '총학생회', window: null },
          { id: 'club', label: '학생단체', window: null },
        ],
      },
    ],
    sort: { key: 'order', scopeFacetId: 'day' },
  };
  const at = (iso: string) => Date.parse(iso);

  describe('defaultFacetSelection', () => {
    it('opens on the day that contains now, and on 전체 for an optional facet', () => {
      expect(defaultFacetSelection(LIST, at('2026-10-02T19:00:00+09:00'))).toEqual({ day: 'day2', org: null });
      expect(defaultFacetSelection(LIST, at('2026-10-01T12:00:00+09:00'))).toEqual({ day: 'day1', org: null });
    });

    it('opens on the first day before the festival and after it', () => {
      expect(defaultFacetSelection(LIST, at('2026-09-24T12:00:00+09:00')).day).toBe('day1');
      expect(defaultFacetSelection(LIST, at('2026-10-05T12:00:00+09:00')).day).toBe('day1');
    });
  });

  describe('filterByFacets', () => {
    const both = place({ id: 'both', facets: { day: ['day1', 'day2'], org: ['club'] } });
    const one = place({ id: 'one', facets: { day: ['day1'], org: ['council'] } });
    const two = place({ id: 'two', facets: { day: ['day2'], org: [] } });

    it('puts a two-day place under both days', () => {
      expect(ids(filterByFacets([both, one, two], LIST, { day: 'day1', org: null }))).toEqual(['both', 'one']);
      expect(ids(filterByFacets([both, one, two], LIST, { day: 'day2', org: null }))).toEqual(['both', 'two']);
    });

    it('narrows by every selected facet, and leaves out an untagged place once one is chosen', () => {
      expect(ids(filterByFacets([both, one, two], LIST, { day: 'day2', org: 'club' }))).toEqual(['both']);
      expect(ids(filterByFacets([both, one, two], LIST, { day: 'day2', org: 'council' }))).toEqual([]);
    });

    it('keeps everything when nothing is selected', () => {
      expect(ids(filterByFacets([both, one, two], LIST, {}))).toEqual(['both', 'one', 'two']);
    });
  });

  describe('sortForList', () => {
    it("orders a booth by its running order for the selected day, falling back to order", () => {
      const a = place({ id: 'a', order: 1, orderByOption: { day1: 3, day2: 1 } });
      const b = place({ id: 'b', order: 2, orderByOption: { day1: 1, day2: 3 } });
      const c = place({ id: 'c', order: 2 });
      expect(ids(sortForList([a, b, c], LIST, { day: 'day1', org: null }))).toEqual(['b', 'c', 'a']);
      expect(ids(sortForList([a, b, c], LIST, { day: 'day2', org: null }))).toEqual(['a', 'c', 'b']);
    });

    it('ignores orderByOption when the sort is not scoped', () => {
      const unscoped: MapChipList = { ...LIST, sort: { key: 'order', scopeFacetId: null } };
      const a = place({ id: 'a', order: 2, orderByOption: { day1: 0 } });
      const b = place({ id: 'b', order: 1 });
      expect(ids(sortForList([a, b], unscoped, { day: 'day1', org: null }))).toEqual(['b', 'a']);
    });

    it('sorts a title list in 가나다 order, whatever the order field says', () => {
      const byTitle: MapChipList = { facets: [], sort: { key: 'title', scopeFacetId: null } };
      const trucks = ['희망츄러스', '건강가족', '오야봉', '냠냠쩝쩝', '파라다이스 커피'].map((ko, i) =>
        place({ id: `t${i}`, order: i, text: { ko, en: ko } }),
      );
      expect(sortForList(trucks, byTitle, {}).map((p) => p.text.ko)).toEqual([
        '건강가족',
        '냠냠쩝쩝',
        '오야봉',
        '파라다이스 커피',
        '희망츄러스',
      ]);
    });
  });
});
