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

export function useLayerMarkers(endpoint: string, enabled: boolean) {
  return useQuery<RawMarkerData[]>({
    queryKey: ['map', 'layer', 'markers', endpoint],
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
    queryKey: ['map', 'layer', 'polyline', endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint, parsePolylineData);
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}
