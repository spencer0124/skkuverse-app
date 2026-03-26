/**
 * Buildings list query hook.
 *
 * Fetches from GET /building/list. Building data rarely changes.
 *
 * Flutter source: lib/features/building/data/building_repository.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseBuildingList } from '../building/parser';
import type { Building } from '../types/building';

export const BUILDINGS_KEY = ['building', 'list'] as const;

export function useBuildings() {
  return useQuery<Building[]>({
    queryKey: BUILDINGS_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.buildingList(),
        parseBuildingList,
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    staleTime: 10 * 60_000,
  });
}
