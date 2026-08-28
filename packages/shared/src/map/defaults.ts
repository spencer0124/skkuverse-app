/**
 * Default map config fallback — used when GET /map/config fails.
 *
 * `layers` must mirror the server's `src/map/map-config.data.ts`. It had drifted
 * badly: a single `campus_buildings` layer pointing at `/building/list`, which no
 * longer exists server-side and returns `{ buildings: [] }` where parseMarkerData
 * reads `data.markers[]` — so the fallback rendered zero markers, which is worse
 * than having no fallback at all because it looks like an empty campus rather
 * than a failure. The server has shipped two layers for a while: building numbers
 * and building names, separately toggleable.
 *
 * Both point at the SAME endpoint, which is the server's shape and not a typo:
 * they are the same documents differing only in which field becomes the visible
 * string, and each layer renders the subset carrying its own `layerId`. The
 * marker cache is keyed on the endpoint string, so two toggles cost one fetch.
 * The old `?overlay=number|label` is gone — a server still receiving it ignores
 * it, but keeping it here would split one cache entry into two.
 *
 * Labels are raw Korean strings, not i18n keys, matching the server: layer labels
 * are server-driven display text that FilterSheet renders as-is.
 *
 * Flutter source: lib/features/campus_map/data/mock/map_config_mock.dart
 */

import type { MapConfig } from '../types/map';

export const DEFAULT_MAP_CONFIG: MapConfig = {
  naver: {},
  campuses: [
    {
      id: 'hssc',
      label: '인사캠',
      centerLat: 37.587241,
      centerLng: 126.992858,
      defaultZoom: 15.8,
      defaultTilt: 0,
      defaultBearing: 0,
    },
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
  layers: [
    {
      id: 'building_numbers',
      type: 'marker',
      label: '건물번호',
      defaultVisible: true,
      endpoint: '/map/markers/campus',
      markerStyle: 'numberCircle',
      userConfigurable: true,
    },
    {
      id: 'building_labels',
      type: 'marker',
      label: '건물이름',
      defaultVisible: true,
      endpoint: '/map/markers/campus',
      markerStyle: 'textLabel',
      userConfigurable: true,
    },
  ],
};
