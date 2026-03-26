/**
 * Bus group config query hook.
 *
 * Fetches bus group config from `GET /bus/config/{groupId}`.
 * Config rarely changes — generous staleTime handles caching (ETag deferred).
 *
 * Flutter source: lib/features/transit/data/bus_config_repository.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseBusGroup } from '../bus/parser';
import type { BusGroup } from '../types/bus';

export const BUS_CONFIG_KEY = ['bus', 'config'] as const;

export function useBusConfig(groupId: string | undefined) {
  return useQuery<BusGroup | undefined>({
    queryKey: [...BUS_CONFIG_KEY, groupId],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.busConfigGroup(groupId!),
        parseBusGroup,
      );

      if (result.ok) {
        return result.data;
      }

      if (__DEV__) {
        console.debug('[bus] Config fetch failed:', result.failure);
      }
      return undefined;
    },
    enabled: !!groupId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
