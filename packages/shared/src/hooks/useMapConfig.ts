/**
 * Map config query hook.
 *
 * Fetches from GET /map/config. Falls back to DEFAULT_MAP_CONFIG when a fetch
 * fails with no good config to keep (same pattern as useCampusSections).
 *
 * The queryFn throws rather than returning the defaults — see `dataOrFallback`.
 * This route is not edge-cached, so a festival-day 5xx or 429 reaches the app;
 * cached as a success, the defaults (which carry no festival layers) would
 * hide every booth for the whole staleTime.
 *
 * Flutter source: lib/features/campus_map/controller/map_config_controller.dart
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseMapConfig } from '../map/parser';
import { DEFAULT_MAP_CONFIG } from '../map/defaults';
import { dataOrFallback } from './fallback';
import type { MapConfig } from '../types/map';

export const MAP_CONFIG_KEY = ['map', 'config'] as const;

export function useMapConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<MapConfig>({
    queryKey: MAP_CONFIG_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.mapConfig(),
        parseMapConfig,
      );

      if (result.ok) return result.data;

      if (__DEV__) {
        console.debug('[map] config API failed:', result.failure);
      }
      throw result.failure;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: MAP_CONFIG_KEY });

  return { ...query, data: dataOrFallback(query, DEFAULT_MAP_CONFIG), refresh };
}
