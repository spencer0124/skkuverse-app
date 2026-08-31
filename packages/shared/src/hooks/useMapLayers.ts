/**
 * Map layer data hooks — the dynamic-endpoint query behind every drawn layer.
 *
 * Endpoints come from `MapLayerDef.endpoint` (server-driven), so this file
 * names no URL. One query per DATA SOURCE, not per layer or per geometry: the
 * campus collection carries buildings and hand-authored shapes, the event
 * collection carries a festival's places, and both hand back pins, zones and
 * route lines together for the caller to filter by `layerId`.
 *
 * Flutter source: lib/features/campus_map/controller/map_layer_controller.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { parseOverlayData } from '../map/parser';
import type { MapOverlay } from '../types/map';

/**
 * Key PREFIX, not a key: the endpoint string is appended, so every layer sharing
 * an endpoint shares one entry and an invalidation of this prefix reaches all of
 * them. Exported so a cache-busting caller does not restate the array — a
 * silently-wrong query key invalidates nothing and reports no error.
 *
 * Keying on the endpoint is what makes 건물번호 and 건물이름 two toggles over one
 * fetch, and the six festival layers one more. Turning a second layer on over a
 * source already loaded costs nothing at the network layer, which is what keeps
 * the filter grid instant on a festival network.
 */
export const MAP_LAYER_OVERLAYS_KEY = ['map', 'layer', 'overlays'] as const;

export function useLayerOverlays(endpoint: string, enabled: boolean) {
  return useQuery<MapOverlay[]>({
    queryKey: [...MAP_LAYER_OVERLAYS_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint, parseOverlayData);
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}
