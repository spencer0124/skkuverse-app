/**
 * The overlay parser against the bytes production actually served.
 *
 * The unit suite next door feeds `parseOverlayData` shapes chosen to exercise
 * one rule each. This one feeds it real documents from both collections, and
 * what it guards is the seam those cannot see: that the field names, the
 * nesting and the value shapes the server ships are the ones the parser reaches
 * for.
 *
 * That seam is not hypothetical here — it is the reason this file exists. The
 * server renamed `data.markers` to `data.overlays` and moved `lat`/`lng` inside
 * a GeoJSON `geometry`, and because layer endpoints are server-driven the
 * shipped app followed the new route, received 200 OK, read the key it had
 * always read, coalesced the absent value to `[]`, and drew an empty campus map
 * with nothing in any log. A parser reading for a key the server does not send
 * answers `undefined` and reports success. Only real bytes catch that.
 *
 * ## These fixtures are a SLICE, and deliberately so
 *
 * The live collections are 137 and 61 overlays, ~77 KB of near-duplicate
 * documents. What this suite reads is field shapes, not volume, so each fixture
 * keeps a deterministic sample: up to two overlays per (layer, campus) for the
 * campus collection, and one per layer for the event collection plus whichever
 * documents carry the shapes a uniform sample would miss — multiple `hours`,
 * empty `hours`, a populated `actions`, a non-null `subtitle`.
 *
 * A snapshot, not a contract. A festival closing changes what the live endpoint
 * returns; it does not change what this file asserts, and a failure here means
 * the SCHEMA moved. The contract is skkuverse-server
 * `docs/reference/map-overlays-api.md`.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import { parseOverlayData } from '../parser';
import { overlayAnchor } from '../geometry';
import campusLive from './fixtures/map-overlays-campus-live.json';
import eventLive from './fixtures/map-overlays-event-live.json';

const CAMPUS = parseOverlayData(campusLive as unknown as ApiEnvelope<unknown>);
const EVENT = parseOverlayData(eventLive as unknown as ApiEnvelope<unknown>);

describe('the live campus collection, parsed whole', () => {
  it('keeps every overlay the fixture holds', () => {
    // Nothing dropped. A drop here is the parser rejecting something real, and
    // since a drop is silent by design that is exactly what needs an assertion.
    expect(CAMPUS).toHaveLength(campusLive.data.overlays.length);
  });

  it('reads the geometry rather than answering Null Island', () => {
    // The whole-response version of the axis check. Every building sits in
    // Seoul or Suwon, so a transposed read would put the lot near the equator
    // — and `toLatLng`'s range guard would have dropped them instead, which the
    // length assertion above already catches. Both directions are covered.
    for (const o of CAMPUS) {
      expect(o.kind).toBe('marker');
      if (o.kind !== 'marker') continue;
      expect(o.lat).toBeGreaterThan(37);
      expect(o.lat).toBeLessThan(38);
      expect(o.lng).toBeGreaterThan(126);
      expect(o.lng).toBeLessThan(128);
    }
  });

  it('draws each building on both building layers under one id', () => {
    // The documented duplicate: one building, two layers, same id, different
    // `text`. The React key is layerId + id, so this is correct rather than a
    // collision — and a parser that deduped on id would silently halve the map.
    const byLayer = new Set(CAMPUS.map((o) => o.layerId));
    expect(byLayer).toContain('building_numbers');
    expect(byLayer).toContain('building_labels');
  });

  it('serves both campuses from the one collection', () => {
    expect(new Set(CAMPUS.map((o) => o.campus))).toEqual(new Set(['hssc', 'nsc']));
  });

  it('leaves a building the stated emptiness of the booth-shaped half', () => {
    // Not absent keys. The server fills them, so the parser's fallbacks are
    // never the thing under test in production — this asserts the server still
    // holds up its end.
    for (const o of CAMPUS) {
      expect(o.subtitle).toBeNull();
      expect(o.fields).toEqual([]);
      expect(o.actions).toEqual([]);
      expect(o.hours).toEqual([]);
    }
  });

  it('routes every tap at a building', () => {
    for (const o of CAMPUS) expect(o.tap?.kind).toBe('skku_building');
  });
});

describe('the live event collection, parsed whole', () => {
  it('keeps every overlay the fixture holds', () => {
    expect(EVENT).toHaveLength(eventLive.data.overlays.length);
  });

  it('reads the fields a building never exercises', () => {
    // The half of the schema the campus collection leaves empty. Reading these
    // off real bytes is what caught them being served under different names.
    expect(EVENT.some((o) => o.hours.length > 0)).toBe(true);
    expect(EVENT.some((o) => o.subtitle !== null)).toBe(true);
    expect(EVENT.some((o) => o.actions.length > 0)).toBe(true);
  });

  it('keeps a place that is always open as empty hours, not as a null pair', () => {
    // `[]` is the one spelling of always-open, and the reason there is no
    // `status` beside it.
    expect(EVENT.some((o) => o.hours.length === 0)).toBe(true);
  });

  it('carries a complete URL on every webview button', () => {
    // The server resolves a root-relative value against WEBVIEW_ORIGIN before
    // it ships, because a relative string handed to a URL opener is the shape
    // of an open redirect. This asserts it actually did.
    for (const o of EVENT) {
      for (const a of o.actions) {
        if (a.actionType !== 'webview') continue;
        expect(a.actionValue).toMatch(/^https:\/\//);
      }
    }
  });

  it('addresses every tap as an event, whichever festival is live', () => {
    // The kind names the MECHANISM, not the festival, so next year's config
    // changes no client branch.
    for (const o of EVENT) expect(o.tap?.kind).toBe('event');
  });

  it('gives every overlay an anchor the camera can fly to', () => {
    for (const o of EVENT) {
      const { lat, lng } = overlayAnchor(o);
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lng)).toBe(true);
    }
  });
});
