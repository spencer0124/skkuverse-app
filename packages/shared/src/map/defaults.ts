/**
 * Default map config fallback — used when GET /map/config fails.
 *
 * `layers` must mirror the server's `src/map/map-config.data.ts`. It had drifted
 * badly: a single `campus_buildings` layer pointing at `/building/list`, which no
 * longer exists server-side and returns `{ buildings: [] }` where the overlay
 * parser reads `data.overlays[]` — so the fallback rendered nothing, which is worse
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
 * These two strings are the ONLY map URLs the app hardcodes; every other one
 * arrives as `layers[].endpoint` from `/map/config`. That is exactly what makes
 * them easy to leave behind on a route change and hard to notice — the app
 * keeps working until the config call fails, and then lands on a 404 in the one
 * situation where it has no other way to draw a map.
 *
 * Labels are raw Korean strings, not i18n keys, matching the server: layer labels
 * are server-driven display text that FilterSheet renders as-is.
 *
 * Flutter source: lib/features/campus_map/data/mock/map_config_mock.dart
 */

import type { MapCameraDefaults, MapConfig } from '../types/map';

/**
 * The camera settings a server predating `cameraDefaults` does not send.
 *
 * These are the literals `CampusScreen` used to repeat at three call sites,
 * kept in one place so the fallback and the wire cannot disagree about how
 * close "close" is. `parseMapConfig` fills member by member from here, so a
 * partial object on the wire cannot produce a NaN zoom.
 */
export const DEFAULT_CAMERA_DEFAULTS: MapCameraDefaults = {
  markerFocus: { zoom: 17.5, tilt: 0, bearing: 0, durationMs: 500 },
  campusFocus: { durationMs: 500 },
};

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
      label: '건물번호',
      defaultVisibleWhen: { kind: 'always' },
      endpoint: '/map/overlays/campus',
      markerStyle: 'numberCircle',
      userConfigurable: true,
      chipGroupId: null,
    },
    {
      id: 'building_labels',
      label: '건물이름',
      defaultVisibleWhen: { kind: 'always' },
      endpoint: '/map/overlays/campus',
      markerStyle: 'textLabel',
      userConfigurable: true,
      chipGroupId: null,
    },
  ],
  // Empty rather than a mirror of the chips the server happens to serve today.
  // Every chip that exists is festival-gated or points at a web page, and both
  // are things this fallback cannot know are still true — an offline start gets
  // no chip row, which is honest, instead of a row of buttons that may lead
  // nowhere.
  chips: [],
  cameraDefaults: DEFAULT_CAMERA_DEFAULTS,
};
