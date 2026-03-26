/**
 * Building detail query hook.
 *
 * Fetches from GET /building/{skkuId}. Enabled only when skkuId is provided.
 *
 * Flutter source: lib/features/building/data/building_repository.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseBuildingDetail } from '../building/parser';
import type { BuildingDetail } from '../types/building';

export const BUILDING_DETAIL_KEY = ['building', 'detail'] as const;

export function useBuildingDetail(skkuId: number | null) {
  return useQuery<BuildingDetail>({
    queryKey: [...BUILDING_DETAIL_KEY, skkuId],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.buildingDetail(skkuId!),
        parseBuildingDetail,
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: skkuId != null,
    staleTime: 5 * 60_000,
  });
}
