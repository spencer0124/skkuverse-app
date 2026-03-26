/**
 * Building search query hook.
 *
 * Fetches from GET /building/search?q=...&campus=...
 * Only enabled when query has content.
 *
 * Flutter source: lib/features/building/data/building_repository.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseBuildingSearchResult } from '../building/parser';
import type { BuildingSearchResult } from '../types/building';

export const BUILDING_SEARCH_KEY = ['building', 'search'] as const;

export function useSearchBuildings(query: string, campus?: string) {
  return useQuery<BuildingSearchResult>({
    queryKey: [...BUILDING_SEARCH_KEY, query, campus],
    queryFn: async () => {
      const params: Record<string, string> = { q: query };
      if (campus) params.campus = campus;

      const result = await safeGet(
        ApiEndpoints.buildingSearch(),
        parseBuildingSearchResult,
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}
