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

const envelope = (data: unknown): ApiEnvelope<unknown> => ({
  meta: { code: 200 },
  data,
});

const layer = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  type: 'marker',
  label: 'L',
  defaultVisible: true,
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
  startAt: null,
  endAt: null,
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
      envelope({ markers: [marker({ tap: { kind: 'eskara26', placeId: 'nsc-plaza-a3' } })] }),
    );
    expect(out[0]?.tap).toEqual({ kind: 'eskara26', placeId: 'nsc-plaza-a3' });
  });

  it('keeps the marker but makes it inert on an unknown tap kind', () => {
    // Fail soft: a kind we cannot route is still a place we can draw, and a
    // missing pin is a failure nobody can see or report.
    const out = parseMarkerData(
      envelope({ markers: [marker({ tap: { kind: 'eskara27', placeId: 'x' } })] }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.tap).toBeNull();
  });

  it('accepts tap: null, which the degraded building fallback ships deliberately', () => {
    const out = parseMarkerData(envelope({ markers: [marker({ tap: null })] }));
    expect(out[0]?.tap).toBeNull();
  });

  it('keeps both bounds null, which means always visible and only that', () => {
    const out = parseMarkerData(envelope({ markers: [marker()] }));
    expect(out[0]?.startAt).toBeNull();
    expect(out[0]?.endAt).toBeNull();
  });

  it('keeps a parseable instant verbatim', () => {
    const out = parseMarkerData(
      envelope({ markers: [marker({ startAt: '2026-09-16T07:00:00.000Z' })] }),
    );
    expect(out[0]?.startAt).toBe('2026-09-16T07:00:00.000Z');
  });

  it('drops an unparseable instant to null rather than carrying NaN into the window', () => {
    // Every comparison against NaN is false, so `now >= startAt` and `now < endAt`
    // would both fail and the marker would silently never draw.
    const out = parseMarkerData(envelope({ markers: [marker({ startAt: 'soon' })] }));
    expect(out[0]?.startAt).toBeNull();
  });
});
