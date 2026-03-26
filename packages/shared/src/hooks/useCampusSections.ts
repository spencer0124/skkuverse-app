/**
 * Campus sections query hook.
 *
 * Fetches SDUI sections from `GET /ui/home/campus` via TanStack Query.
 * On API failure, returns DEFAULT_CAMPUS_SECTIONS — queryFn never throws,
 * so `isError` is never true (matches Flutter controller fallback pattern).
 *
 * Flutter source: lib/features/campus_map/controller/campus_map_controller.dart
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseCampusResponse } from '../sdui/parser';
import { DEFAULT_CAMPUS_SECTIONS } from '../sdui/defaults';
import type { CampusSectionsResponse } from '../types/sdui';

export const CAMPUS_SECTIONS_KEY = ['campus', 'sections'] as const;

export function useCampusSections() {
  const queryClient = useQueryClient();

  const query = useQuery<CampusSectionsResponse>({
    queryKey: CAMPUS_SECTIONS_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.homeCampus(),
        parseCampusResponse,
      );

      if (result.ok) {
        return result.data;
      }

      // API failure → fallback to defaults (never throw)
      if (__DEV__) {
        console.debug(
          '[campus] API failed, using defaults:',
          result.failure,
        );
      }
      return DEFAULT_CAMPUS_SECTIONS;
    },
    staleTime: 60_000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: CAMPUS_SECTIONS_KEY });

  return {
    ...query,
    refresh,
  };
}
