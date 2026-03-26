/**
 * Smart schedule query hook.
 *
 * Fetches schedule data from a service-specific endpoint.
 * ETag caching deferred — TanStack Query caching sufficient for MVP.
 *
 * Flutter source: lib/features/transit/data/bus_repository.dart (getSmartSchedule)
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { parseSmartSchedule } from '../bus/parser';
import type { SmartSchedule } from '../types/bus';

export const SMART_SCHEDULE_KEY = ['bus', 'schedule'] as const;

export function useSmartSchedule(endpoint: string | undefined) {
  return useQuery<SmartSchedule | null>({
    queryKey: [...SMART_SCHEDULE_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint!, parseSmartSchedule);

      if (result.ok) {
        return result.data;
      }

      if (__DEV__) {
        console.debug('[bus] Schedule fetch failed:', result.failure);
      }
      return null;
    },
    enabled: !!endpoint,
    staleTime: 30_000,
  });
}
