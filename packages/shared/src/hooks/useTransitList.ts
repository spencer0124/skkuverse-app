/**
 * Transit list query hook.
 *
 * Fetches bus list items from `GET /ui/home/transitlist` via TanStack Query.
 * On API failure, returns empty array — queryFn never throws.
 *
 * Flutter source: lib/features/transit/controller/transit_controller.dart
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseTransitList } from '../bus/parser';
import type { BusListItem } from '../types/bus';

export const TRANSIT_LIST_KEY = ['transit', 'list'] as const;

export function useTransitList() {
  const queryClient = useQueryClient();

  const query = useQuery<BusListItem[]>({
    queryKey: TRANSIT_LIST_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.homeTransitList(),
        parseTransitList,
      );

      if (result.ok) {
        return result.data;
      }

      throw result.failure;
    },
    staleTime: 60_000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: TRANSIT_LIST_KEY });

  return {
    ...query,
    refresh,
  };
}
