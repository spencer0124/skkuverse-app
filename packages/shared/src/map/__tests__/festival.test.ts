/**
 * The client festival gate on the shipped 3.5.4 runtime.
 *
 * This build has no event map, so the gate has one job: keep `/map/config`'s
 * festival layers out of `MapConfig.layers`. Everything that would otherwise go
 * wrong here — the filter sheet's tiles, the stacked captionless pins, the
 * inert taps — follows from that list.
 *
 * The load-bearing assertion is the endpoint one. A surviving
 * `/map/markers/event` layer would mean the app still fetches booth data with
 * the gate shut, and no amount of UI absence would make that safe.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import type { MapConfig, MapLayerDef } from '../../types/map';
import { parseMapConfig } from '../parser';
import { DEFAULT_MAP_CONFIG } from '../defaults';
import { isFestivalLayer, withoutFestival } from '../festival';

const envelope = (data: unknown): ApiEnvelope<unknown> => ({
  meta: { code: 200 },
  data,
});

const layer = (over: Partial<MapLayerDef> & { id: string }): MapLayerDef => ({
  type: 'marker',
  label: over.id,
  defaultVisible: true,
  endpoint: '/map/markers/event',
  chipGroupId: 'eskara-2026',
  ...over,
});

const config = (over: Partial<MapConfig> = {}): MapConfig => ({
  naver: {},
  campuses: [],
  layers: [],
  ...over,
});

describe('parseMapConfig — chipGroupId, the field this runtime never read', () => {
  const parseLayer = (raw: Record<string, unknown>) =>
    parseMapConfig(
      envelope({
        layers: [{ id: 'l1', type: 'marker', label: 'L', endpoint: '/x', ...raw }],
      }),
    ).layers[0];

  it('keeps a declared group verbatim', () => {
    expect(parseLayer({ chipGroupId: 'eskara-2026' }).chipGroupId).toBe('eskara-2026');
  });

  it('parses an absent, null or empty group to null', () => {
    // The safe direction: an unrecognised layer is permanent campus furniture
    // and is kept, not stripped from a map that would then lose its buildings.
    expect(parseLayer({}).chipGroupId).toBeNull();
    expect(parseLayer({ chipGroupId: null }).chipGroupId).toBeNull();
    expect(parseLayer({ chipGroupId: '' }).chipGroupId).toBeNull();
    expect(parseLayer({ chipGroupId: 7 }).chipGroupId).toBeNull();
  });
});

describe('isFestivalLayer — the discriminator', () => {
  it('reads a layer in a chip group as festival', () => {
    expect(isFestivalLayer(layer({ id: 'eskara26_stage' }))).toBe(true);
  });

  it('reads a layer in no chip group as permanent', () => {
    expect(
      isFestivalLayer(
        layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/markers/campus' }),
      ),
    ).toBe(false);
  });
});

describe('withoutFestival — what survives the gate', () => {
  it('drops the festival layers and keeps the permanent ones', () => {
    const out = withoutFestival(
      config({
        layers: [
          layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/markers/campus' }),
          layer({ id: 'eskara26_stage' }),
          layer({ id: 'eskara26_bar' }),
        ],
      }),
    );
    expect(out.layers.map((l) => l.id)).toEqual(['building_numbers']);
  });

  it('leaves no layer pointing at the event marker endpoint', () => {
    // The load-bearing one. A marker layer only fetches while it is rendered,
    // so this is what proves the gate stops the network and not merely the UI.
    const out = withoutFestival(
      config({
        layers: [
          layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/markers/campus' }),
          layer({ id: 'eskara26_stage' }),
          layer({ id: 'eskara26_food' }),
          layer({ id: 'eskara26_facility', defaultVisible: false }),
        ],
      }),
    );
    for (const l of out.layers) expect(l.endpoint).not.toBe('/map/markers/event');
  });

  it('leaves the campuses and the naver config alone', () => {
    const input = config({
      naver: { styleId: 'abc' },
      campuses: [
        {
          id: 'nsc',
          label: '자과캠',
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
    expect(out.naver).toBe(input.naver);
  });

  it('returns the same object when there is nothing to strip', () => {
    // Identity, not equality. `mapConfig` is a dependency of CampusScreen's
    // initFromConfig effect, so a fresh object every render would re-seed the
    // layer store on every paint.
    const input = config({ layers: [layer({ id: 'building_numbers', chipGroupId: null })] });
    expect(withoutFestival(input)).toBe(input);
    expect(withoutFestival(DEFAULT_MAP_CONFIG)).toBe(DEFAULT_MAP_CONFIG);
  });

  it('survives a server that sends no chipGroupId at all', () => {
    // A server predating the field: every layer parses to null, nothing is
    // festival, and the map renders exactly as it does today.
    const parsed = parseMapConfig(
      envelope({
        layers: [
          { id: 'building_numbers', type: 'marker', label: '건물번호', endpoint: '/map/markers/campus' },
        ],
      }),
    );
    expect(withoutFestival(parsed)).toBe(parsed);
  });
});
