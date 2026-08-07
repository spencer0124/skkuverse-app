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
  skkuId: 1,
  lat: 37.29,
  lng: 126.97,
  campus: 'nsc',
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
      envelope({ markers: [marker({ skkuId: 1 }), marker({ skkuId: 2, lat: null }), marker({ skkuId: 3 })] }),
    );
    expect(out.map((m) => m.skkuId)).toEqual([1, 3]);
  });

  it('returns [] for a payload with no markers key at all', () => {
    expect(parseMarkerData(envelope({}))).toEqual([]);
  });
});
