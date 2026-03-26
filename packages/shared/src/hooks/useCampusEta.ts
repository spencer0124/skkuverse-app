/**
 * Campus ETA query hook.
 *
 * Fetches inter-campus shuttle ETA from `GET /bus/campus/eta`.
 * Conditionally enabled — only fetches when the schedule screen has a heroCard.
 *
 * Flutter source: lib/features/transit/controller/bus_campus_controller.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseCampusEta } from '../bus/parser';
import type { CampusEta } from '../types/bus';

export const CAMPUS_ETA_KEY = ['bus', 'campusEta'] as const;

export function useCampusEta(enabled = true) {
  return useQuery<CampusEta>({
    queryKey: CAMPUS_ETA_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.campusEta(),
        parseCampusEta,
      );

      if (result.ok) {
        return result.data;
      }

      if (__DEV__) {
        console.debug('[bus] Campus ETA failed:', result.failure);
      }
      return { inja: null, jain: null };
    },
    enabled,
    staleTime: 60_000,
  });
}
