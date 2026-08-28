/**
 * Map layer data hooks — dynamic endpoint queries for markers and polylines.
 *
 * Endpoints come from MapLayerDef.endpoint (server-driven).
 * Each layer fetches independently and only when enabled.
 *
 * Flutter source: lib/features/campus_map/controller/map_layer_controller.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { parseMarkerData, parsePolylineData } from '../map/parser';
import type { RawMarkerData, PolylineCoord } from '../types/map';

/**
 * Key PREFIX, not a key: the endpoint string is appended, so every layer sharing
 * an endpoint shares one entry and an invalidation of this prefix reaches all of
 * them. Exported so a cache-busting caller does not restate the array — a
 * silently-wrong query key invalidates nothing and reports no error.
 */
export const MAP_LAYER_MARKERS_KEY = ['map', 'layer', 'markers'] as const;
export const MAP_LAYER_POLYLINE_KEY = ['map', 'layer', 'polyline'] as const;

export function useLayerMarkers(endpoint: string, enabled: boolean) {
  return useQuery<RawMarkerData[]>({
    queryKey: [...MAP_LAYER_MARKERS_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint, parseMarkerData);
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useLayerPolyline(endpoint: string, enabled: boolean) {
  return useQuery<PolylineCoord[]>({
    queryKey: [...MAP_LAYER_POLYLINE_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint, parsePolylineData);
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}
