/**
 * The client festival gate.
 *
 * Two things are being pinned here, and only the second needs the fixture.
 *
 * The unit cases pin the RULE — festival is `chipGroupId !== null`, every chip
 * goes, and a config with nothing to strip comes back by identity.
 *
 * The fixture case pins the rule against the bytes production actually served
 * during an open activation, which is the only place the rule can be shown to
 * separate the right layers. Its load-bearing assertion is the endpoint one: a
 * surviving `/map/markers/event` layer would mean the app still fetches booth
 * data with the gate shut, and no amount of UI absence would make that safe.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import type { MapConfig, MapChip, MapLayerDef } from '../../types/map';
import { parseMapConfig } from '../parser';
import { DEFAULT_MAP_CONFIG, DEFAULT_CAMERA_DEFAULTS } from '../defaults';
import { isFestivalLayer, withoutFestival } from '../festival';
import liveConfig from './fixtures/map-config-live.json';

const layer = (over: Partial<MapLayerDef> & { id: string }): MapLayerDef => ({
  type: 'marker',
  label: over.id,
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/map/markers/event',
  chipGroupId: 'eskara-2026',
  userConfigurable: true,
  ...over,
});

const chip = (id: string, action: MapChip['action']): MapChip => ({
  id,
  label: id,
  icon: null,
  action,
  isReset: false,
});

const config = (over: Partial<MapConfig> = {}): MapConfig => ({
  naver: {},
  campuses: [],
  layers: [],
  chips: [],
  cameraDefaults: DEFAULT_CAMERA_DEFAULTS,
  ...over,
});

describe('isFestivalLayer — the discriminator', () => {
  it('reads a layer in a chip group as festival', () => {
    expect(isFestivalLayer(layer({ id: 'eskara26_stage' }))).toBe(true);
  });

  it('reads a layer in no chip group as permanent', () => {
    // The safe direction, and the one a server predating `chipGroupId` lands in:
    // an unrecognised layer is treated as campus furniture and kept, rather than
    // stripped from a map that would then be missing its buildings.
    expect(isFestivalLayer(layer({ id: 'building_numbers', chipGroupId: null }))).toBe(false);
  });
});

describe('withoutFestival — what survives the gate', () => {
  it('drops the festival layers and keeps the permanent ones', () => {
    const out = withoutFestival(
      config({
        layers: [
          layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/markers/campus' }),
          layer({ id: 'eskara26_stage' }),
        ],
      }),
    );
    expect(out.layers.map((l) => l.id)).toEqual(['building_numbers']);
  });

  it('drops every chip, including one that names no layer at all', () => {
    // The reason this is "all chips" rather than "chips naming a stripped
    // layer": `layerIds: []` is the spelling for a camera-only chip, so a
    // reference-based filter keeps it — and it would fly the camera to an empty
    // festival ground.
    const out = withoutFestival(
      config({
        chips: [
          chip('camera_only', {
            kind: 'focus',
            camera: { lat: 37.29, lng: 126.97, ...DEFAULT_CAMERA_DEFAULTS.markerFocus },
            layerIds: [],
          }),
          chip('a_web_page', { kind: 'webview', url: 'https://example.com' }),
        ],
      }),
    );
    expect(out.chips).toEqual([]);
  });

  it('leaves the campuses and camera defaults alone', () => {
    const input = config({
      campuses: [
        {
          id: 'nsc',
          label: '자연과학캠퍼스',
          centerLat: 37.29358,
          centerLng: 126.974942,
          defaultZoom: 15.8,
          defaultTilt: 0,
          defaultBearing: 0,
        },
      ],
      layers: [layer({ id: 'eskara26_stage' })],
    });
    const out = withoutFestival(input);
    expect(out.campuses).toBe(input.campuses);
    expect(out.cameraDefaults).toBe(input.cameraDefaults);
  });

  it('returns the same object when there is nothing to strip', () => {
    // Identity, not equality. `mapConfig` is a dependency of the
    // `initFromConfig` effect and of four memos in CampusScreen; a fresh object
    // every render would re-seed the layer store on every paint.
    const input = config({
      layers: [layer({ id: 'building_numbers', chipGroupId: null })],
    });
    expect(withoutFestival(input)).toBe(input);
    expect(withoutFestival(DEFAULT_MAP_CONFIG)).toBe(DEFAULT_MAP_CONFIG);
  });
});

describe('withoutFestival — against the live open-festival response', () => {
  const CONFIG = parseMapConfig(liveConfig as unknown as ApiEnvelope<unknown>);
  const gated = withoutFestival(CONFIG);

  it('is stripping something, so the assertions below mean something', () => {
    // Guards the fixture itself: were it captured with the activation closed,
    // every assertion here would pass vacuously.
    expect(CONFIG.layers.length).toBeGreaterThan(gated.layers.length);
    expect(CONFIG.chips.length).toBeGreaterThan(0);
  });

  it('leaves exactly the two permanent building layers', () => {
    expect(gated.layers.map((l) => l.id)).toEqual(['building_numbers', 'building_labels']);
  });

  it('leaves no layer pointing at the event marker endpoint', () => {
    // The load-bearing one. A marker layer only fetches while it is rendered, so
    // this is what proves the gate stops the network and not merely the UI.
    for (const l of gated.layers) expect(l.endpoint).toBe('/map/markers/campus');
  });

  it('leaves no chip row to render', () => {
    expect(gated.chips).toEqual([]);
  });
});
