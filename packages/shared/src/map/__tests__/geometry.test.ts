/**
 * The one seam where a GeoJSON position becomes a named `LatLng`.
 *
 * This file exists because of the failure mode rather than the function's
 * complexity. An axis swap NEVER THROWS: `[37.58, 126.97]` is a perfectly valid
 * array of two finite numbers, and reading it as `[lng, lat]` puts 성균관대 in the
 * Yellow Sea while every layer, cache and renderer reports success. There is no
 * error to catch and no visual that looks broken — the pins are simply
 * somewhere else.
 *
 * So the defence is structural: exactly ONE conversion in the codebase, and a
 * test that pins the order in both directions. The guard that makes a swap
 * detectable at all is latitude's ±90 bound — Seoul's longitude is 126.97,
 * which cannot be a latitude, so a transposed pair is rejected rather than
 * drawn. That only works for coordinates outside ±90 longitude; it is a
 * tripwire, not a proof, which is why the single-conversion rule is the real
 * protection and this suite guards it.
 *
 * Wire contract: skkuverse-server `docs/reference/map-overlays-api.md` §2.4.
 */

import { describe, it, expect } from 'vitest';
import type { MapOverlay } from '../../types/map';
import { toLatLng, overlayAnchor } from '../geometry';

/** 수선관, 인사캠 — a real building, so a swap is visibly wrong rather than abstract. */
const SUSEON = { lat: 37.587361, lng: 126.994479 };

const base = {
  id: 'x',
  layerId: 'l1',
  campus: 'hssc' as const,
  text: { ko: 'ㄱ', en: 'a' },
  subtitle: null,
  hours: [],
  fields: [],
  actions: [],
  order: 0,
  tap: null,
};

const marker = (lat: number, lng: number): MapOverlay => ({
  ...base,
  kind: 'marker',
  lat,
  lng,
  pinPriority: 0,
});

const polygon = (rings: { lat: number; lng: number }[][]): MapOverlay => ({
  ...base,
  kind: 'polygon',
  rings,
});

const path = (line: { lat: number; lng: number }[]): MapOverlay => ({
  ...base,
  kind: 'path',
  line,
});

describe('toLatLng — the wire is [lng, lat], and only here', () => {
  it('reads longitude first, latitude second', () => {
    // RFC 7946 §3.1.1, "precisely in that order". If this ever reads the other
    // way the whole map moves and nothing reports an error.
    expect(toLatLng([SUSEON.lng, SUSEON.lat])).toEqual(SUSEON);
  });

  it('rejects a transposed Seoul pair instead of drawing it in the sea', () => {
    // 126.99 is not a latitude. This is the tripwire that catches the swap the
    // docblock above describes — the only automatic one available.
    expect(toLatLng([SUSEON.lat, SUSEON.lng])).toBeNull();
  });

  it('accepts the bounds themselves', () => {
    // Half-open would silently drop the antimeridian and the poles, neither of
    // which is a data error.
    expect(toLatLng([180, 90])).toEqual({ lat: 90, lng: 180 });
    expect(toLatLng([-180, -90])).toEqual({ lat: -90, lng: -180 });
  });

  it('keeps Null Island, which is a real position', () => {
    // `[0, 0]` is valid GeoJSON. Dropping it would be discarding data to catch
    // a bug that the null case below catches properly.
    expect(toLatLng([0, 0])).toEqual({ lat: 0, lng: 0 });
  });

  it('drops a null coordinate rather than coercing it to Null Island', () => {
    // The trap the old parser fell into: `Number(null)` is 0, so a nulled
    // coordinate became a marker at 0,0 instead of no marker at all.
    expect(toLatLng([null, 37.5])).toBeNull();
    expect(toLatLng([126.9, null])).toBeNull();
  });

  it('drops a value that is not a finite number', () => {
    expect(toLatLng(['126.9', '37.5'])).toBeNull();
    expect(toLatLng([NaN, 37.5])).toBeNull();
    expect(toLatLng([Infinity, 37.5])).toBeNull();
  });

  it('drops anything that is not a position at all', () => {
    expect(toLatLng(undefined)).toBeNull();
    expect(toLatLng(null)).toBeNull();
    expect(toLatLng([126.9])).toBeNull();
    expect(toLatLng({ lat: 37.5, lng: 126.9 })).toBeNull();
  });

  it('ignores a third element, which RFC 7946 allows as altitude', () => {
    // Refusing it would drop a position that is spec-valid and drawable.
    expect(toLatLng([126.9, 37.5, 120])).toEqual({ lat: 37.5, lng: 126.9 });
  });
});

describe('overlayAnchor — one point per overlay, whatever its geometry', () => {
  // What this is FOR: the camera move and the `?place=` deep link. Both need a
  // single coordinate, and a zone has no natural one. Derived rather than
  // stored on the overlay, so it can never disagree with the geometry it
  // summarises.

  it('gives a marker its own position, exactly', () => {
    expect(overlayAnchor(marker(SUSEON.lat, SUSEON.lng))).toEqual(SUSEON);
  });

  it('centres a polygon on its exterior ring', () => {
    const ring = [
      { lat: 10, lng: 20 },
      { lat: 10, lng: 40 },
      { lat: 30, lng: 40 },
      { lat: 30, lng: 20 },
      { lat: 10, lng: 20 }, // closed
    ];
    expect(overlayAnchor(polygon([ring]))).toEqual({ lat: 20, lng: 30 });
  });

  it('is not skewed by the repeated position that closes a ring', () => {
    // A closed ring lists its first corner twice. An average of the vertices
    // would drift toward that corner; the bounding box cannot.
    const square = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 10, lng: 10 },
      { lat: 10, lng: 0 },
      { lat: 0, lng: 0 },
    ];
    expect(overlayAnchor(polygon([square]))).toEqual({ lat: 5, lng: 5 });
  });

  it('ignores holes, which cannot move where a zone is', () => {
    const outer = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 10, lng: 10 },
      { lat: 0, lng: 0 },
    ];
    const hole = [
      { lat: 100, lng: 100 },
      { lat: 100, lng: 101 },
      { lat: 101, lng: 101 },
      { lat: 100, lng: 100 },
    ];
    expect(overlayAnchor(polygon([outer, hole]))).toEqual({ lat: 5, lng: 5 });
  });

  it('centres a path on its extent, not on its middle vertex', () => {
    // A route's vertices are unevenly spaced — a dense curve at one end would
    // drag an index-midpoint there and leave the rest off screen.
    const line = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 20, lng: 20 },
    ];
    expect(overlayAnchor(path(line))).toEqual({ lat: 10, lng: 10 });
  });
});
