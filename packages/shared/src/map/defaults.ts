/**
 * Default map config fallback — used when GET /map/config fails.
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
      id: 'campus_buildings',
      type: 'marker',
      label: '건물번호',
      defaultVisible: true,
      endpoint: '/building/list',
      markerStyle: 'numberCircle',
    },
  ],
};
