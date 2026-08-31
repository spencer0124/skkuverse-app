/**
 * Map parser — the two defects this suite exists to keep fixed.
 *
 * D1: `raw.type as 'marker' | 'polyline'` typed an unknown value as a union member
 *     it was not. It then matched no render branch, so the layer disappeared with
 *     no error, no warning and nothing to grep for.
 *
 * D2: `Number(raw.lat ?? 0)` turned a missing coordinate into (0, 0). Null Island
 *     is in the Gulf of Guinea, and a marker drawn there looks like a data problem
 *     on the map rather than a parser problem in the code. `Number(null)` is also
 *     0, so the `??` was never the only thing doing the damage.
 *
 * D3: layers share endpoints, so a marker without `layerId` would be drawn by
 *     every layer reading that response — which is how two building layers came
 *     to draw all 137 buildings each.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import { parseMapConfig, parseMarkerData } from '../parser';
import { DEFAULT_CAMERA_DEFAULTS, DEFAULT_MAP_CONFIG } from '../defaults';

const envelope = (data: unknown): ApiEnvelope<unknown> => ({
  meta: { code: 200 },
  data,
});

const layer = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  type: 'marker',
  label: 'L',
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/x',
  ...over,
});

const marker = (over: Record<string, unknown> = {}) => ({
  id: '1',
  layerId: 'building_numbers',
  lat: 37.29,
  lng: 126.97,
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

const parseLayers = (raw: Record<string, unknown>) =>
  parseMapConfig(envelope({ layers: [layer(raw)] })).layers[0];

describe('parseMapConfig — D1, closed unions are checked not asserted', () => {
  it('passes a known layer type through', () => {
    expect(parseLayers({ type: 'polyline' }).type).toBe('polyline');
  });

  it('falls an unknown layer type back to marker rather than a lying union', () => {
    // 'marker' because CampusScreen's loop is a binary else — anything that is not
    // 'polyline' already renders as a marker layer, so this is what actually happens.
    expect(parseLayers({ type: 'heatmap' }).type).toBe('marker');
  });

  it('falls a missing layer type back to marker', () => {
    expect(parseLayers({ type: undefined }).type).toBe('marker');
  });

  it('passes a known markerStyle through', () => {
    expect(parseLayers({ markerStyle: 'textLabel' }).markerStyle).toBe('textLabel');
  });

  it('drops an unknown markerStyle to undefined so the default branch renders', () => {
    expect(parseLayers({ markerStyle: 'hexagon' }).markerStyle).toBeUndefined();
  });

  it('passes placeDot through — the event layers arrived style-less without it', () => {
    expect(parseLayers({ markerStyle: 'placeDot' }).markerStyle).toBe('placeDot');
  });

  it('reads an absent userConfigurable as true — never fail closed', () => {
    // A server predating the field must not silently lock every control on the
    // map. Only an explicit `false` hides a toggle.
    expect(parseLayers({}).userConfigurable).toBe(true);
    expect(parseLayers({ userConfigurable: false }).userConfigurable).toBe(false);
    expect(parseLayers({ userConfigurable: true }).userConfigurable).toBe(true);
  });

  it('rejects a non-string type instead of coercing it', () => {
    expect(parseLayers({ type: 7 }).type).toBe('marker');
  });
});

describe('parseMarkerData — D2, a missing coordinate is not (0, 0)', () => {
  it('keeps a well-formed marker', () => {
    const out = parseMarkerData(envelope({ markers: [marker()] }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lat: 37.29, lng: 126.97 });
  });

  it('drops a null latitude — the Number(null) === 0 trap', () => {
    expect(parseMarkerData(envelope({ markers: [marker({ lat: null })] }))).toEqual([]);
  });

  it('drops a missing longitude', () => {
    expect(parseMarkerData(envelope({ markers: [marker({ lng: undefined })] }))).toEqual([]);
  });

  it('drops an unparseable coordinate instead of emitting NaN', () => {
    expect(parseMarkerData(envelope({ markers: [marker({ lat: 'abc' })] }))).toEqual([]);
  });

  it('drops an empty-string coordinate, which Number() would call 0', () => {
    expect(parseMarkerData(envelope({ markers: [marker({ lat: '' })] }))).toEqual([]);
  });

  it('accepts a numeric string, which the API has been known to send', () => {
    const out = parseMarkerData(envelope({ markers: [marker({ lat: '37.29' })] }));
    expect(out[0]?.lat).toBe(37.29);
  });

  it('drops an out-of-range latitude', () => {
    expect(parseMarkerData(envelope({ markers: [marker({ lat: 200 })] }))).toEqual([]);
  });

  it('drops a [lng, lat]-swapped Seoul pair, which never throws on its own', () => {
    // Seoul is lat 37.29 / lng 126.97. Swapped, the latitude reads 126.97 — out of
    // range, so the range check catches for free what would otherwise silently
    // render a marker in the ocean.
    expect(
      parseMarkerData(envelope({ markers: [marker({ lat: 126.97, lng: 37.29 })] })),
    ).toEqual([]);
  });

  it('drops only the bad marker, keeping its neighbours', () => {
    const out = parseMarkerData(
      envelope({ markers: [marker({ id: '1' }), marker({ id: '2', lat: null }), marker({ id: '3' })] }),
    );
    expect(out.map((m) => m.id)).toEqual(['1', '3']);
  });

  it('returns [] for a payload with no markers key at all', () => {
    expect(parseMarkerData(envelope({}))).toEqual([]);
  });
});

describe('parseMarkerData — D3, a marker belongs to exactly one layer', () => {
  it('drops a marker with no layerId rather than drawing it on every layer', () => {
    expect(
      parseMarkerData(envelope({ markers: [marker({ layerId: undefined })] })),
    ).toEqual([]);
  });

  it('drops a marker with no id — the React key is layerId plus id', () => {
    expect(parseMarkerData(envelope({ markers: [marker({ id: undefined })] }))).toEqual([]);
  });

  it('keeps the same id on two layers, which is the documented case not a collision', () => {
    // One building is emitted once per building layer with the same id. The key
    // is layerId + id, so this is correct rather than a duplicate.
    const out = parseMarkerData(
      envelope({
        markers: [
          marker({ id: '2', layerId: 'building_numbers', text: { ko: '1', en: '1' } }),
          marker({ id: '2', layerId: 'building_labels', text: { ko: '600주년기념관', en: '600th' } }),
        ],
      }),
    );
    expect(out.map((m) => m.layerId)).toEqual(['building_numbers', 'building_labels']);
  });
});

describe('parseMarkerData — text, the field that replaced displayNo', () => {
  it('carries zh when ops authored one', () => {
    const out = parseMarkerData(
      envelope({
        markers: [marker({ text: { ko: '우끼끼친', en: 'Ukkikki', zh: '乌key' } })],
      }),
    );
    expect(out[0]?.text).toEqual({ ko: '우끼끼친', en: 'Ukkikki', zh: '乌key' });
  });

  it('falls en back to ko when the English string is empty, not just missing', () => {
    // Both writers of the buildings collection coalesce a missing English name to
    // '' rather than null, so a `??` fallback here would ship blank labels.
    const out = parseMarkerData(envelope({ markers: [marker({ text: { ko: '수선관', en: '' } })] }));
    expect(out[0]?.text.en).toBe('수선관');
  });

  it('drops a marker with no ko text — it would draw blank but still eat a tap target', () => {
    expect(
      parseMarkerData(envelope({ markers: [marker({ text: { ko: '', en: 'x' } })] })),
    ).toEqual([]);
  });
});

describe('parseMarkerData — tap and window', () => {
  it('narrows a known tap kind', () => {
    const out = parseMarkerData(
      envelope({ markers: [marker({ tap: { kind: 'event', placeId: 'nsc-plaza-a3' } })] }),
    );
    expect(out[0]?.tap).toEqual({ kind: 'event', placeId: 'nsc-plaza-a3' });
  });

  it('keeps the marker but makes it inert on an unknown tap kind', () => {
    // Fail soft: a kind we cannot route is still a place we can draw, and a
    // missing pin is a failure nobody can see or report.
    const out = parseMarkerData(
      envelope({ markers: [marker({ tap: { kind: 'eskara26', placeId: 'x' } })] }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.tap).toBeNull();
  });

  it('accepts tap: null, which the degraded building fallback ships deliberately', () => {
    const out = parseMarkerData(envelope({ markers: [marker({ tap: null })] }));
    expect(out[0]?.tap).toBeNull();
  });

  it('keeps an absent hours list empty, which means always open and only that', () => {
    const out = parseMarkerData(envelope({ markers: [marker({ hours: undefined })] }));
    expect(out[0]?.hours).toEqual([]);
  });

  it('keeps a fully bounded window verbatim', () => {
    const hours = [{ startAt: '2026-09-16T07:00:00.000Z', endAt: '2026-09-16T11:00:00.000Z' }];
    const out = parseMarkerData(envelope({ markers: [marker({ hours })] }));
    expect(out[0]?.hours).toEqual(hours);
  });

  it('keeps every window of a place open on two days', () => {
    // The whole reason `hours` is an array: one window per document made a booth
    // open on both festival days into two documents, and the list showed it twice.
    const hours = [
      { startAt: '2026-08-27T09:00:00.000Z', endAt: '2026-08-27T15:00:00.000Z' },
      { startAt: '2026-08-28T09:00:00.000Z', endAt: '2026-08-28T15:00:00.000Z' },
    ];
    const out = parseMarkerData(envelope({ markers: [marker({ hours })] }));
    expect(out[0]?.hours).toHaveLength(2);
  });

  it('drops a half-bounded window rather than admitting a second way to say "no limit"', () => {
    const out = parseMarkerData(
      envelope({
        markers: [marker({ hours: [{ startAt: '2026-09-16T07:00:00.000Z', endAt: null }] })],
      }),
    );
    expect(out[0]?.hours).toEqual([]);
  });

  it('drops an unparseable bound rather than carrying NaN into the comparison', () => {
    // Every comparison against NaN is false, so the window would never be open
    // and the place would read as permanently closed with nothing to blame.
    const out = parseMarkerData(
      envelope({ markers: [marker({ hours: [{ startAt: 'soon', endAt: 'later' }] })] }),
    );
    expect(out[0]?.hours).toEqual([]);
  });
});

describe('parseMarkerData — the place document the card renders', () => {
  it('reads subtitle, fields and actions', () => {
    const out = parseMarkerData(
      envelope({
        markers: [
          marker({
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
          }),
        ],
      }),
    );
    expect(out[0]?.subtitle?.ko).toBe('연합 주점');
    expect(out[0]?.fields).toHaveLength(1);
    expect(out[0]?.actions[0]?.style).toBe('primary');
  });

  it('leaves a building\'s booth-shaped half as stated emptiness', () => {
    const out = parseMarkerData(envelope({ markers: [marker()] }));
    expect(out[0]?.subtitle).toBeNull();
    expect(out[0]?.fields).toEqual([]);
    expect(out[0]?.actions).toEqual([]);
  });

  it('keeps a button whose actionType this build cannot route', () => {
    // `parseActionType` degrades it to 'unknown', which the handler declines to
    // open. A button that does nothing beats a booth that is missing.
    const out = parseMarkerData(
      envelope({
        markers: [
          marker({
            actions: [
              { id: 'a1', label: { ko: 'X' }, actionType: 'teleport', actionValue: 'x' },
            ],
          }),
        ],
      }),
    );
    expect(out[0]?.actions[0]?.actionType).toBe('unknown');
  });

  it('drops a button with no value, and serves the place without it', () => {
    const out = parseMarkerData(
      envelope({
        markers: [
          marker({
            actions: [{ id: 'a1', label: { ko: 'X' }, actionType: 'webview', actionValue: '' }],
          }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.actions).toEqual([]);
  });

  it('defaults order and pinPriority to 0 rather than NaN', () => {
    // NaN would make every collision comparison false and the ladder non-total.
    const out = parseMarkerData(envelope({ markers: [marker({ order: 'first' })] }));
    expect(out[0]?.order).toBe(0);
    expect(out[0]?.pinPriority).toBe(0);
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
