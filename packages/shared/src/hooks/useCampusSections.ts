/**
 * Campus sections query hook.
 *
 * Fetches SDUI sections from `GET /ui/home/campus` via TanStack Query.
 * On API failure with no good feed to keep, returns DEFAULT_CAMPUS_SECTIONS.
 * The queryFn throws rather than returning them, so a failure is never cached
 * over a good feed — see `dataOrFallback`.
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
import { dataOrFallback } from './fallback';
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

      if (__DEV__) {
        console.debug('[campus] API failed:', result.failure);
      }
      throw result.failure;
    },
    staleTime: 60_000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: CAMPUS_SECTIONS_KEY });

  return {
    ...query,
    data: dataOrFallback(query, DEFAULT_CAMPUS_SECTIONS),
    refresh,
  };
}
