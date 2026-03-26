/**
 * Map config query hook.
 *
 * Fetches from GET /map/config. Falls back to DEFAULT_MAP_CONFIG on failure
 * (same pattern as useCampusSections — queryFn never throws).
 *
 * Flutter source: lib/features/campus_map/controller/map_config_controller.dart
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseMapConfig } from '../map/parser';
import { DEFAULT_MAP_CONFIG } from '../map/defaults';
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
        console.debug('[map] config API failed, using defaults:', result.failure);
      }
      return DEFAULT_MAP_CONFIG;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: MAP_CONFIG_KEY });

  return { ...query, refresh };
}
