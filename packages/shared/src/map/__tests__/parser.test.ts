/**
 * Map parser — the defects this suite exists to keep fixed.
 *
 * D1: a closed union read with a blind `as` typed an unknown value as a member
 *     it was not. It then matched no render branch, so the thing disappeared
 *     with no error, no warning and nothing to grep for. The layer `type` that
 *     first showed this is gone — an overlay's own `kind` names its renderer
 *     now — but `markerStyle`, `shape` and every tap kind are read the same way
 *     and the rule is unchanged: check membership, never assert it.
 *
 * D2: `Number(raw.lat ?? 0)` turned a missing coordinate into (0, 0). Null
 *     Island is in the Gulf of Guinea, and a marker drawn there looks like a
 *     data problem on the map rather than a parser problem in the code.
 *     `Number(null)` is also 0, so the `??` was never the only thing doing the
 *     damage. Coordinates arrive as GeoJSON `[lng, lat]` now, which moves the
 *     trap without removing it — see `geometry.test.ts` for the axis order
 *     itself.
 *
 * D3: layers share endpoints, so an overlay without `layerId` would be drawn by
 *     every layer reading that response — which is how two building layers came
 *     to draw all 137 buildings each.
 *
 * D4: `kind` is an OPEN enum. The server reserves five more renderers and adds
 *     them without a client release, so an unrecognised one must cost exactly
 *     one overlay. An exhaustive switch asserting `never` — the instinct a
 *     closed union earns — is what would turn that additive change into a blank
 *     layer on every shipped build.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import { parseMapConfig, parseOverlayData } from '../parser';
import { DEFAULT_CAMERA_DEFAULTS, DEFAULT_MAP_CONFIG } from '../defaults';

const envelope = (data: unknown): ApiEnvelope<unknown> => ({
  meta: { code: 200 },
  data,
});

const layer = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  label: 'L',
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/x',
  ...over,
});

/**
 * A GeoJSON position, written in the WIRE's order.
 *
 * Longitude first — RFC 7946 §3.1.1, "precisely in that order". Spelled out at
 * every call site rather than hidden behind a `{ lat, lng }` helper, because a
 * parser test that writes the tuple the readable way round is exactly how a
 * suite comes to certify the swap it exists to catch.
 */
const pos = (lng: unknown, lat: unknown) => [lng, lat];

const point = (lng: unknown, lat: unknown) => ({ type: 'Point', coordinates: pos(lng, lat) });

/** 자과캠, and the coordinate every overlay below sits on unless it says otherwise. */
const NSC = { lng: 126.97, lat: 37.29 };

const overlay = (over: Record<string, unknown> = {}) => ({
  kind: 'marker',
  id: '1',
  layerId: 'building_numbers',
  geometry: point(NSC.lng, NSC.lat),
  campus: 'nsc',
  text: { ko: '수선관', en: 'Suseon Hall' },
  subtitle: null,
  hours: [],
  fields: [],
  actions: [],
  order: 0,
  pinPriority: 0,
  tap: { kind: 'skku_building', placeId: '1' },
  ...over,
});

/** A closed square ring, wound as RFC 7946 wants it. Positions are `[lng, lat]`. */
const RING = [pos(0, 0), pos(10, 0), pos(10, 10), pos(0, 10), pos(0, 0)];

const parseLayers = (raw: Record<string, unknown>) =>
  parseMapConfig(envelope({ layers: [layer(raw)] })).layers[0];

const parseOne = (over: Record<string, unknown> = {}) =>
  parseOverlayData(envelope({ overlays: [overlay(over)] }));

describe('parseMapConfig — D1, closed unions are checked not asserted', () => {
  it('passes a known markerStyle through', () => {
    expect(parseLayers({ markerStyle: 'textLabel' }).markerStyle).toBe('textLabel');
  });

  it('drops an unknown markerStyle to undefined so the default branch renders', () => {
    expect(parseLayers({ markerStyle: 'hexagon' }).markerStyle).toBeUndefined();
  });

  it('passes placeDot through — the event layers arrived style-less without it', () => {
    expect(parseLayers({ markerStyle: 'placeDot' }).markerStyle).toBe('placeDot');
  });

  it('rejects a non-string markerStyle instead of coercing it', () => {
    expect(parseLayers({ markerStyle: 7 }).markerStyle).toBeUndefined();
  });

  it('reads an absent userConfigurable as true — never fail closed', () => {
    // A server predating the field must not silently lock every control on the
    // map. Only an explicit `false` hides a toggle.
    expect(parseLayers({}).userConfigurable).toBe(true);
    expect(parseLayers({ userConfigurable: false }).userConfigurable).toBe(false);
    expect(parseLayers({ userConfigurable: true }).userConfigurable).toBe(true);
  });

  it('carries no renderer on a layer — an overlay names its own', () => {
    // The `type` field this once asserted is gone. A layer that named a renderer
    // decided it twice, once here and once by the geometry, and the two could
    // disagree with nothing to blame. Its absence is what lets one layer hold
    // pins, a zone and a route line at once.
    expect(parseLayers({ type: 'polyline' })).not.toHaveProperty('type');
  });
});

describe('parseOverlayData — D4, kind is an open enum', () => {
  it('reads each renderer this build has', () => {
    const out = parseOverlayData(
      envelope({
        overlays: [
          overlay({ id: 'm', kind: 'marker' }),
          overlay({ id: 'z', kind: 'polygon', geometry: { type: 'Polygon', coordinates: [RING] } }),
          overlay({ id: 'r', kind: 'path', geometry: { type: 'LineString', coordinates: [pos(0, 0), pos(1, 1)] } }),
        ],
      }),
    );
    expect(out.map((o) => o.kind)).toEqual(['marker', 'polygon', 'path']);
  });

  it('drops ONE unknown kind and keeps every sibling', () => {
    // The contract in a single assertion. The server reserves `circle`,
    // `groundImage` and three more, and ships them without a client release —
    // so the cost of one has to be one overlay, never its layer and never the
    // forty markers beside it.
    const out = parseOverlayData(
      envelope({
        overlays: [
          overlay({ id: 'before' }),
          overlay({ id: 'future', kind: 'groundImage' }),
          overlay({ id: 'after' }),
        ],
      }),
    );
    expect(out.map((o) => o.id)).toEqual(['before', 'after']);
  });

  it('drops an absent or non-string kind the same way', () => {
    expect(parseOne({ kind: undefined })).toEqual([]);
    expect(parseOne({ kind: 7 })).toEqual([]);
  });

  it('returns [] for a payload with no overlays key at all', () => {
    // The shape the marker routes left behind: this parser reading `data.markers`
    // off an overlay body is precisely how the campus map went blank in
    // production with a 200 on the wire.
    expect(parseOverlayData(envelope({}))).toEqual([]);
    expect(parseOverlayData(envelope({ markers: [overlay()] }))).toEqual([]);
  });
});

describe('parseOverlayData — D2, geometry is [lng, lat] and a missing one is not (0, 0)', () => {
  it('keeps a well-formed marker, longitude first', () => {
    const out = parseOne();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'marker', lat: NSC.lat, lng: NSC.lng });
  });

  it('drops a null coordinate — the Number(null) === 0 trap', () => {
    expect(parseOne({ geometry: point(NSC.lng, null) })).toEqual([]);
    expect(parseOne({ geometry: point(null, NSC.lat) })).toEqual([]);
  });

  it('drops a numeric STRING rather than coercing it', () => {
    // A deliberate tightening. The old flat wire came through a layer that
    // stringified numbers, so tolerating '37.29' was right there. GeoJSON
    // positions are numbers — Mongo's 2dsphere index refuses anything else, and
    // the server checks them with `Number.isFinite` — so a string here is
    // corruption rather than a formatting quirk, and matching the server's
    // strictness is what keeps the two ends from disagreeing about one document.
    expect(parseOne({ geometry: point('126.97', '37.29') })).toEqual([]);
  });

  it('drops an out-of-range latitude', () => {
    expect(parseOne({ geometry: point(NSC.lng, 200) })).toEqual([]);
  });

  it('drops a [lat, lng]-swapped Seoul pair, which never throws on its own', () => {
    // Written the wrong way round: latitude reads 126.97, out of range, so the
    // bound catches for free what would otherwise render 성균관대 in the sea.
    expect(parseOne({ geometry: point(NSC.lat, NSC.lng) })).toEqual([]);
  });

  it('drops geometry that is absent, malformed, or the wrong type for its kind', () => {
    expect(parseOne({ geometry: undefined })).toEqual([]);
    expect(parseOne({ geometry: { type: 'Point' } })).toEqual([]);
    expect(parseOne({ geometry: { type: 'Point', coordinates: [126.97] } })).toEqual([]);
    // A marker whose geometry is a Polygon: the kind and the geometry disagree,
    // and guessing which one the author meant is how a renderer crashes later.
    expect(parseOne({ geometry: { type: 'Polygon', coordinates: [RING] } })).toEqual([]);
  });

  it('drops only the bad overlay, keeping its neighbours', () => {
    const out = parseOverlayData(
      envelope({
        overlays: [
          overlay({ id: '1' }),
          overlay({ id: '2', geometry: point(NSC.lng, null) }),
          overlay({ id: '3' }),
        ],
      }),
    );
    expect(out.map((o) => o.id)).toEqual(['1', '3']);
  });

  it('drops a marker on an unknown campus rather than putting it on the wrong map', () => {
    expect(parseOne({ campus: 'moon' })).toEqual([]);
  });
});

describe('parseOverlayData — polygon, where a zone gets its rings', () => {
  const zone = (coordinates: unknown) =>
    parseOne({ kind: 'polygon', geometry: { type: 'Polygon', coordinates } });

  it('reads the exterior ring in wire order, converting every position', () => {
    const out = zone([RING]);
    expect(out).toHaveLength(1);
    const o = out[0]!;
    expect(o.kind).toBe('polygon');
    if (o.kind !== 'polygon') return;
    expect(o.rings).toHaveLength(1);
    expect(o.rings[0]?.[1]).toEqual({ lat: 0, lng: 10 });
  });

  it('keeps the repeated position that closes the ring', () => {
    // The SDK needs a closed ring, and trimming the duplicate here would push
    // the job of re-closing it onto the renderer.
    const o = zone([RING])[0]!;
    if (o.kind !== 'polygon') return;
    expect(o.rings[0]).toHaveLength(RING.length);
    expect(o.rings[0]?.[0]).toEqual(o.rings[0]?.[RING.length - 1]);
  });

  it('keeps holes as the rings after the first', () => {
    const hole = [pos(2, 2), pos(4, 2), pos(4, 4), pos(2, 2)];
    const o = zone([RING, hole])[0]!;
    if (o.kind !== 'polygon') return;
    expect(o.rings).toHaveLength(2);
    expect(o.rings[1]).toHaveLength(4);
  });

  it('drops the whole zone when any ring holds a bad position', () => {
    // Not a partial ring: a polygon missing one corner is a different shape, and
    // drawing the wrong outline over a campus is worse than drawing none.
    expect(zone([[pos(0, 0), pos(10, 0), pos(10, null), pos(0, 0)]])).toEqual([]);
  });

  it('drops a ring too short to bound an area', () => {
    // Four, not three: a triangle is three corners plus the repeat that closes
    // it. The server's `isDrawableGeometry` refuses the same shapes.
    expect(zone([[pos(0, 0), pos(10, 0), pos(0, 0)]])).toEqual([]);
    expect(zone([])).toEqual([]);
  });

  it('carries no pinPriority — a zone has no collision to resolve', () => {
    // Two overlapping zones are a design choice, not a conflict. The union makes
    // the field unrepresentable here rather than merely unused.
    expect(zone([RING])[0]).not.toHaveProperty('pinPriority');
  });
});

describe('parseOverlayData — path, where a route gets its line', () => {
  const route = (coordinates: unknown) =>
    parseOne({ kind: 'path', geometry: { type: 'LineString', coordinates } });

  it('reads the line in order, converting every position', () => {
    const o = route([pos(0, 0), pos(1, 2), pos(3, 4)])[0]!;
    expect(o.kind).toBe('path');
    if (o.kind !== 'path') return;
    expect(o.line).toEqual([
      { lat: 0, lng: 0 },
      { lat: 2, lng: 1 },
      { lat: 4, lng: 3 },
    ]);
  });

  it('drops a line of fewer than two positions, which cannot be drawn', () => {
    expect(route([pos(0, 0)])).toEqual([]);
    expect(route([])).toEqual([]);
  });

  it('drops the whole route when any position is bad', () => {
    expect(route([pos(0, 0), pos(null, 1), pos(2, 2)])).toEqual([]);
  });
});

describe('parseOverlayData — D3, an overlay belongs to exactly one layer', () => {
  it('drops an overlay with no layerId rather than drawing it on every layer', () => {
    expect(parseOne({ layerId: undefined })).toEqual([]);
  });

  it('drops an overlay with no id — the React key is layerId plus id', () => {
    expect(parseOne({ id: undefined })).toEqual([]);
  });

  it('keeps the same id on two layers, which is the documented case not a collision', () => {
    // One building is emitted once per building layer with the same id. The key
    // is layerId + id, so this is correct rather than a duplicate.
    const out = parseOverlayData(
      envelope({
        overlays: [
          overlay({ id: '2', layerId: 'building_numbers', text: { ko: '1', en: '1' } }),
          overlay({ id: '2', layerId: 'building_labels', text: { ko: '600주년기념관', en: '600th' } }),
        ],
      }),
    );
    expect(out.map((o) => o.layerId)).toEqual(['building_numbers', 'building_labels']);
  });
});

describe('parseOverlayData — text, the field that replaced displayNo', () => {
  it('carries zh when ops authored one', () => {
    const out = parseOne({ text: { ko: '우끼끼친', en: 'Ukkikki', zh: '乌key' } });
    expect(out[0]?.text).toEqual({ ko: '우끼끼친', en: 'Ukkikki', zh: '乌key' });
  });

  it('falls en back to ko when the English string is empty, not just missing', () => {
    // Both writers of the buildings collection coalesce a missing English name to
    // '' rather than null, so a `??` fallback here would ship blank labels.
    expect(parseOne({ text: { ko: '수선관', en: '' } })[0]?.text.en).toBe('수선관');
  });

  it('drops an overlay with no ko text — it would draw blank but still eat a tap target', () => {
    expect(parseOne({ text: { ko: '', en: 'x' } })).toEqual([]);
  });
});

describe('parseOverlayData — tap and window', () => {
  it('narrows a known tap kind', () => {
    const out = parseOne({ tap: { kind: 'event', placeId: 'nsc-plaza-a3' } });
    expect(out[0]?.tap).toEqual({ kind: 'event', placeId: 'nsc-plaza-a3' });
  });

  it('keeps the overlay but makes it inert on an unknown tap kind', () => {
    // Fail soft: a kind we cannot route is still a place we can draw, and a
    // missing pin is a failure nobody can see or report.
    const out = parseOne({ tap: { kind: 'eskara26', placeId: 'x' } });
    expect(out).toHaveLength(1);
    expect(out[0]?.tap).toBeNull();
  });

  it('accepts tap: null, which is how a backdrop is drawn', () => {
    // A 통제 구간 outline and the degraded building fallback both ship this. The
    // renderer must read it as "draw, do not wire onTap".
    expect(parseOne({ tap: null })[0]?.tap).toBeNull();
  });

  it('keeps an absent hours list empty, which means always open and only that', () => {
    expect(parseOne({ hours: undefined })[0]?.hours).toEqual([]);
  });

  it('keeps a fully bounded window verbatim', () => {
    const hours = [{ startAt: '2026-09-16T07:00:00.000Z', endAt: '2026-09-16T11:00:00.000Z' }];
    expect(parseOne({ hours })[0]?.hours).toEqual(hours);
  });

  it('keeps every window of a place open on two days', () => {
    // The whole reason `hours` is an array: one window per document made a booth
    // open on both festival days into two documents, and the list showed it twice.
    const hours = [
      { startAt: '2026-08-27T09:00:00.000Z', endAt: '2026-08-27T15:00:00.000Z' },
      { startAt: '2026-08-28T09:00:00.000Z', endAt: '2026-08-28T15:00:00.000Z' },
    ];
    expect(parseOne({ hours })[0]?.hours).toHaveLength(2);
  });

  it('drops a half-bounded window rather than admitting a second way to say "no limit"', () => {
    const hours = [{ startAt: '2026-09-16T07:00:00.000Z', endAt: null }];
    expect(parseOne({ hours })[0]?.hours).toEqual([]);
  });

  it('drops an unparseable bound rather than carrying NaN into the comparison', () => {
    // Every comparison against NaN is false, so the window would never be open
    // and the place would read as permanently closed with nothing to blame.
    expect(parseOne({ hours: [{ startAt: 'soon', endAt: 'later' }] })[0]?.hours).toEqual([]);
  });

  it('carries hours on a zone too — a 취식존 closes like a booth does', () => {
    const hours = [{ startAt: '2026-08-27T09:00:00.000Z', endAt: '2026-08-27T15:00:00.000Z' }];
    const out = parseOne({
      kind: 'polygon',
      geometry: { type: 'Polygon', coordinates: [RING] },
      hours,
    });
    expect(out[0]?.hours).toEqual(hours);
  });
});

describe('parseOverlayData — the place document the card renders', () => {
  it('reads subtitle, fields and actions', () => {
    const out = parseOne({
      subtitle: { ko: '연합 주점', en: 'Joint bar' },
      fields: [{ label: { ko: '메뉴', en: 'Menu' }, value: { ko: '골뱅이소면', en: 'Noodles' } }],
      actions: [
        {
          id: 'a1',
          label: { ko: '안내', en: 'Info' },
          actionType: 'webview',
          actionValue: 'https://example.com',
          style: 'primary',
        },
      ],
    });
    expect(out[0]?.subtitle?.ko).toBe('연합 주점');
    expect(out[0]?.fields).toHaveLength(1);
    expect(out[0]?.actions[0]?.style).toBe('primary');
  });

  it("leaves a building's booth-shaped half as stated emptiness", () => {
    const out = parseOne();
    expect(out[0]?.subtitle).toBeNull();
    expect(out[0]?.fields).toEqual([]);
    expect(out[0]?.actions).toEqual([]);
  });

  it('keeps a button whose actionType this build cannot route', () => {
    // `parseActionType` degrades it to 'unknown', which the handler declines to
    // open. A button that does nothing beats a booth that is missing.
    const out = parseOne({
      actions: [{ id: 'a1', label: { ko: 'X' }, actionType: 'teleport', actionValue: 'x' }],
    });
    expect(out[0]?.actions[0]?.actionType).toBe('unknown');
  });

  it('drops a button with no value, and serves the place without it', () => {
    const out = parseOne({
      actions: [{ id: 'a1', label: { ko: 'X' }, actionType: 'webview', actionValue: '' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.actions).toEqual([]);
  });

  it('defaults order and pinPriority to 0 rather than NaN', () => {
    // NaN would make every collision comparison false and the ladder non-total.
    const out = parseOne({ order: 'first' });
    expect(out[0]?.order).toBe(0);
    const o = out[0]!;
    if (o.kind !== 'marker') return;
    expect(o.pinPriority).toBe(0);
  });
});


describe('parseMapConfig — chipGroupId, the group a chip may swap a layer within', () => {
  it('keeps a declared group verbatim', () => {
    expect(parseLayers({ chipGroupId: 'eskara-2026' }).chipGroupId).toBe('eskara-2026');
  });

  it('parses an absent group to null, so no chip may change the layer', () => {
    // The safe direction for a server predating the field: `null` is the
    // server's own meaningful value, not an omission.
    expect(parseLayers({}).chipGroupId).toBeNull();
    expect(parseLayers({ chipGroupId: null }).chipGroupId).toBeNull();
    expect(parseLayers({ chipGroupId: '' }).chipGroupId).toBeNull();
    expect(parseLayers({ chipGroupId: 7 }).chipGroupId).toBeNull();
  });
});

describe('parseMapConfig — defaultVisibleWhen, and which way it fails', () => {
  /**
   * Parse one layer's declaration, with a READABLE anchor layer beside it.
   *
   * The anchor is load-bearing rather than noise: without it a config whose only
   * layer is unreadable trips the floor below and comes back as
   * `DEFAULT_MAP_CONFIG`, so every assertion here would read `building_numbers`
   * and quietly pass on `{ kind: 'always' }`.
   */
  const when = (raw: unknown) =>
    parseMapConfig(
      envelope({
        layers: [layer({ id: 'anchor' }), layer({ id: 'subject', defaultVisibleWhen: raw })],
      }),
    ).layers[1]?.defaultVisibleWhen;

  /** A layer literal with no `defaultVisibleWhen` key at all. */
  const withoutTheKey = () => {
    const { defaultVisibleWhen: _omitted, ...rest } = layer({ id: 'subject' });
    return parseMapConfig(envelope({ layers: [layer({ id: 'anchor' }), rest] })).layers[1]
      ?.defaultVisibleWhen;
  };

  it('keeps each readable kind verbatim', () => {
    expect(when({ kind: 'always' })).toEqual({ kind: 'always' });
    expect(when({ kind: 'never' })).toEqual({ kind: 'never' });
    expect(when({ kind: 'scheduled', windows: [{ start: '18:00', end: '00:00' }] })).toEqual({
      kind: 'scheduled',
      windows: [{ start: '18:00', end: '00:00' }],
    });
  });

  it('reads an UNKNOWN kind as unreadable — which is off, not on', () => {
    // The decision this whole axis turns on. A future server adding a kind this
    // build has not heard of must not have its layer drawn all day: the feature
    // exists to put LESS on screen, so reading a rule we cannot understand as
    // "always" contradicts the intent it was trying to state. `null` is also
    // deliberately not `{ kind: 'never' }` — that is an authoring choice, this
    // is "we could not tell" — so the two stay countable apart.
    expect(when({ kind: 'seasonal', from: '2026-08-27' })).toBeNull();
    expect(when({ kind: 'always ' })).toBeNull();
  });

  it('reads an absent or malformed declaration as unreadable', () => {
    expect(when(undefined)).toBeNull();
    expect(when(null)).toBeNull();
    expect(when('always')).toBeNull();
    expect(when(7)).toBeNull();
    expect(withoutTheKey()).toBeNull();
  });

  it('keeps the windows that parse and drops the ones that do not', () => {
    // Partial data is still a statement of intent, so a bad entry costs its own
    // window and not the layer's whole schedule.
    expect(
      when({
        kind: 'scheduled',
        windows: [
          { start: '11:00', end: '18:00' },
          { start: '18:00', end: '24:00' },
          { start: '7:00', end: '9:00' },
          { start: '10:00', end: '10:00' },
          'nonsense',
          null,
        ],
      }),
    ).toEqual({ kind: 'scheduled', windows: [{ start: '11:00', end: '18:00' }] });
  });

  it('reads a scheduled layer whose every window failed as unreadable, NOT as always', () => {
    // It said "sometimes" and left no way to know when. Neither `always` nor
    // `never` honours that, so it joins the unreadable state rather than being
    // guessed at in the loud direction.
    expect(when({ kind: 'scheduled', windows: [{ start: '25:00', end: '99:99' }] })).toBeNull();
    expect(when({ kind: 'scheduled', windows: [] })).toBeNull();
    expect(when({ kind: 'scheduled' })).toBeNull();
    expect(when({ kind: 'scheduled', windows: 'evening' })).toBeNull();
  });

  it('falls back to the bundled config when NO layer is readable', () => {
    // The floor under fail-closed. One unreadable layer is survivable — it is
    // off, it keeps its filter-sheet tile, the user can turn it on. Every layer
    // unreadable would leave an empty campus: no 건물번호, no 건물이름, nothing.
    const out = parseMapConfig(
      envelope({ layers: [layer({ defaultVisibleWhen: { kind: 'seasonal' } })] }),
    );
    expect(out).toBe(DEFAULT_MAP_CONFIG);
  });

  it('does not fire the floor while one layer is still readable', () => {
    const out = parseMapConfig(
      envelope({
        layers: [
          layer({ id: 'ok' }),
          layer({ id: 'future', defaultVisibleWhen: { kind: 'seasonal' } }),
        ],
      }),
    );
    expect(out).not.toBe(DEFAULT_MAP_CONFIG);
    expect(out.layers.map((l) => l.id)).toEqual(['ok', 'future']);
    expect(out.layers[1]?.defaultVisibleWhen).toBeNull();
  });
});

describe('parseMapConfig — the marker geometry that used to be hardcoded', () => {
  it('reads every style member the server sends', () => {
    const style = parseLayers({
      style: { color: 'F04452', width: 22, height: 30, size: 16, captionTextSize: 9, zIndex: 100000 },
    }).style;
    expect(style).toEqual({
      color: 'F04452',
      outlineColor: undefined,
      width: 22,
      height: 30,
      size: 16,
      captionTextSize: 9,
      zIndex: 100000,
      shape: undefined,
    });
  });
});

describe('parseMapConfig — style.shape, the marker shape axis', () => {
  // The shape axis lives on `style` rather than as a new `markerStyle` member,
  // and these two tests are the reason. An unknown `markerStyle` resolves to
  // `undefined`, which falls through to the building-number branch — a server
  // shipping a new member would make an older build draw every booth as a green
  // numbered circle. An unknown `shape` resolves to `undefined` too, but that
  // reads as "the server did not say" and the client keeps its own default. The
  // failure directions are opposite, which is the whole argument.
  it('passes each known shape through', () => {
    for (const shape of ['pin', 'dot', 'dotThenPin'] as const) {
      expect(parseLayers({ style: { shape } }).style?.shape).toBe(shape);
    }
  });

  it('drops an unknown shape to undefined so the client default renders', () => {
    expect(parseLayers({ style: { shape: 'teardrop' } }).style?.shape).toBeUndefined();
  });

  it('drops a non-string shape to undefined', () => {
    expect(parseLayers({ style: { shape: 3 } }).style?.shape).toBeUndefined();
  });

  it('leaves shape undefined for a server that predates the field', () => {
    expect(parseLayers({ style: { color: 'F04452' } }).style?.shape).toBeUndefined();
  });
});

describe('parseMapConfig — a malformed style value falls back rather than becoming NaN', () => {
  it('drops a non-numeric geometry value to undefined', () => {
    // `Number('16px')` is NaN, and `NaN ?? PIN_WIDTH` is NaN — so the component
    // fallback never fires and the marker draws at width NaN with a React key
    // of `...-NaN`. These values drive real geometry now, so the parser has to
    // be as strict here as it already is for coordinates.
    const style = parseLayers({
      style: { width: '16px', height: true, size: {}, captionTextSize: [], zIndex: null },
    }).style;
    expect(style).toEqual({
      color: undefined,
      outlineColor: undefined,
      width: undefined,
      height: undefined,
      size: undefined,
      captionTextSize: undefined,
      zIndex: undefined,
      shape: undefined,
    });
  });

  it('still accepts a number that arrived as a numeric string', () => {
    expect(parseLayers({ style: { size: '16' } }).style?.size).toBe(16);
  });
});

describe('parseMapConfig — cameraDefaults', () => {
  const parseDefaults = (raw: unknown) =>
    parseMapConfig(envelope({ cameraDefaults: raw })).cameraDefaults;

  it('reads what the server sends', () => {
    expect(
      parseDefaults({
        markerFocus: { zoom: 18, tilt: 30, bearing: 90, durationMs: 700 },
        campusFocus: { durationMs: 250 },
      }),
    ).toEqual({
      markerFocus: { zoom: 18, tilt: 30, bearing: 90, durationMs: 700 },
      campusFocus: { durationMs: 250 },
    });
  });

  it('falls back member by member, so a partial object cannot produce NaN', () => {
    const out = parseDefaults({ markerFocus: { zoom: 18 } });
    expect(out.markerFocus.zoom).toBe(18);
    expect(out.markerFocus.durationMs).toBe(DEFAULT_CAMERA_DEFAULTS.markerFocus.durationMs);
    expect(out.campusFocus).toEqual(DEFAULT_CAMERA_DEFAULTS.campusFocus);
  });

  it('falls back entirely when a server does not send the field', () => {
    expect(parseMapConfig(envelope({})).cameraDefaults).toEqual(DEFAULT_CAMERA_DEFAULTS);
  });
});

describe('parseMapConfig — chips, where an unroutable one is dropped', () => {
  const chip = (over: Record<string, unknown> = {}) => ({
    id: 'eskara26_view_stage',
    label: '공연',
    icon: { kind: 'emoji', emoji: '\u{1F3A4}' },
    action: {
      kind: 'focus',
      camera: { lat: 37.295129, lng: 126.971234, zoom: 17.5, tilt: 0, bearing: 0, durationMs: 500 },
      layerIds: ['eskara26_stage'],
    },
    ...over,
  });
  const parseChips = (raw: unknown[]) => parseMapConfig(envelope({ chips: raw })).chips;

  it('parses a focus chip whole', () => {
    expect(parseChips([chip()])[0]).toEqual({
      id: 'eskara26_view_stage',
      label: '공연',
      icon: { kind: 'emoji', emoji: '\u{1F3A4}' },
      action: {
        kind: 'focus',
        camera: { lat: 37.295129, lng: 126.971234, zoom: 17.5, tilt: 0, bearing: 0, durationMs: 500 },
        layerIds: ['eskara26_stage'],
      },
      isReset: false,
    });
  });

  it('reads isReset, and only an explicit true', () => {
    // The safe direction. Mistaking a narrowing chip for a reset would silently
    // drop the view the user asked for, so anything that is not `true` is an
    // ordinary chip.
    expect(parseChips([chip({ isReset: true })])[0]?.isReset).toBe(true);
    expect(parseChips([chip()])[0]?.isReset).toBe(false);
    expect(parseChips([chip({ isReset: 'true' })])[0]?.isReset).toBe(false);
    expect(parseChips([chip({ isReset: 1 })])[0]?.isReset).toBe(false);
  });

  it('parses a webview chip', () => {
    const out = parseChips([
      chip({ action: { kind: 'webview', url: 'https://webview.skkuverse.com/skku/lostandfound' } }),
    ]);
    expect(out[0]?.action).toEqual({
      kind: 'webview',
      url: 'https://webview.skkuverse.com/skku/lostandfound',
    });
  });

  it('drops a chip whose action kind this build cannot route', () => {
    // The opposite call from parseMarkerTap, deliberately. A marker is a place
    // that also happens to be tappable, so an unroutable one stays drawn; a chip
    // IS its action, so an unroutable one is a button that visibly does nothing.
    expect(parseChips([chip({ action: { kind: 'nearby', origin: 'device', radiusM: 200 } })])).toEqual([]);
  });

  it('drops a focus chip whose camera has no usable coordinate', () => {
    const noCoord = { kind: 'focus', camera: { zoom: 17.5 }, layerIds: [] };
    expect(parseChips([chip({ action: noCoord })])).toEqual([]);
  });

  it('drops a focus chip whose coordinates are swapped', () => {
    // Seoul's longitude is 126.97, so a swapped pair fails |lat| <= 90.
    const swapped = {
      kind: 'focus',
      camera: { lat: 126.971234, lng: 37.295129, zoom: 17.5, tilt: 0, bearing: 0, durationMs: 500 },
      layerIds: [],
    };
    expect(parseChips([chip({ action: swapped })])).toEqual([]);
  });

  it('drops a webview chip with no url', () => {
    expect(parseChips([chip({ action: { kind: 'webview', url: '' } })])).toEqual([]);
  });

  it('drops a chip with no id or no label, which could only render blank', () => {
    expect(parseChips([chip({ id: '' })])).toEqual([]);
    expect(parseChips([chip({ label: '' })])).toEqual([]);
  });

  it('keeps the camera-only chip, whose empty layerIds are meaningful', () => {
    const out = parseChips([chip({ action: { ...chip().action, layerIds: [] } })]);
    expect(out).toHaveLength(1);
    expect(out[0]?.action).toMatchObject({ kind: 'focus', layerIds: [] });
  });

  it('narrows icon to null rather than dropping the chip', () => {
    // `null` was declared before it was reachable, so a text-only chip can
    // arrive without a coordinated release. One branch, not a dropped button.
    expect(parseChips([chip({ icon: null })])[0]?.icon).toBeNull();
    expect(parseChips([chip({ icon: { kind: 'lottie', url: 'x' } })])[0]?.icon).toBeNull();
    expect(parseChips([chip({ icon: { kind: 'emoji', emoji: '' } })])[0]?.icon).toBeNull();
  });

  it('drops only the bad chip, keeping its neighbours', () => {
    const out = parseChips([chip({ id: 'a' }), chip({ id: '' }), chip({ id: 'b' })]);
    expect(out.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('answers an empty list for a server that sends no chips at all', () => {
    expect(parseMapConfig(envelope({})).chips).toEqual([]);
  });

  it('fills a missing camera motion member from the defaults', () => {
    const bare = { kind: 'focus', camera: { lat: 37.29, lng: 126.97 }, layerIds: [] };
    const out = parseChips([chip({ action: bare })]);
    expect(out[0]?.action).toMatchObject({
      kind: 'focus',
      camera: { ...DEFAULT_CAMERA_DEFAULTS.markerFocus, lat: 37.29, lng: 126.97 },
    });
  });

  it("fills it from the RESPONSE's camera defaults, not the bundled ones", () => {
    // Otherwise a server that raises markerFocus.zoom ships a chip omitting
    // `zoom` that focuses at the old value — which is exactly the "a chip's
    // camera and a marker-tap camera disagree about how close close is" failure
    // cameraDefaults was added to remove.
    const out = parseMapConfig(
      envelope({
        cameraDefaults: { markerFocus: { zoom: 18, tilt: 0, bearing: 0, durationMs: 900 } },
        chips: [
          chip({
            action: { kind: 'focus', camera: { lat: 37.29, lng: 126.97 }, layerIds: [] },
          }),
        ],
      }),
    ).chips;
    expect(out[0]?.action).toMatchObject({
      kind: 'focus',
      camera: { zoom: 18, durationMs: 900 },
    });
  });

  it('drops a focus chip whose layerIds are not an array', () => {
    // `[]` is the spelling for the camera-only chip, so a null or a string is a
    // contract violation rather than a second way to say it. Coercing it to `[]`
    // would turn a server bug into a chip that moves the camera and silently
    // changes nothing, with no signal anywhere.
    for (const layerIds of [null, 'eskara26_stage', 3, {}]) {
      expect(parseChips([chip({ action: { ...chip().action, layerIds } })])).toEqual([]);
    }
    expect(parseChips([chip({ action: { kind: 'focus', camera: chip().action.camera } })])).toEqual(
      [],
    );
  });
});
