/**
 * Campus sections query hook.
 *
 * Fetches SDUI sections from `GET /ui/home/campus` via TanStack Query.
 * On API failure, returns DEFAULT_CAMPUS_SECTIONS — queryFn never throws,
 * so `isError` is never true.
 *
 * Those defaults are now empty (see `sdui/defaults.ts`), which means a caller
 * cannot tell a dead API from a server with nothing to show. That is deliberate
 * for the campus sheet, the only consumer: both answers render the same empty
 * card. A future consumer that needs to tell them apart should read
 * `query.isFetched` rather than reintroduce a non-empty fallback here.
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

export interface UseCampusSectionsOptions {
  /**
   * The same client festival gate the map and the event map take. The campus
   * sheet renders nothing while it is shut, so fetching a feed that cannot
   * reach a screen is pure waste — see `apps/mobile/src/features/map/festivalGate.ts`.
   */
  enabled?: boolean;
}

export function useCampusSections({ enabled = true }: UseCampusSectionsOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery<CampusSectionsResponse>({
    queryKey: CAMPUS_SECTIONS_KEY,
    enabled,
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
