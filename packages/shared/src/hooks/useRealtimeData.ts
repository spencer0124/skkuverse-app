/**
 * Realtime bus data polling hook.
 *
 * Polls bus positions from dynamic `dataEndpoint` at `refreshInterval`.
 * `refetchIntervalInBackground: false` stops polling when app is backgrounded
 * (replaces Flutter's WidgetsBindingObserver lifecycle pattern).
 *
 * Flutter source: lib/features/transit/controller/bus_realtime_controller.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { parseRealtimeData } from '../bus/parser';
import type { RealtimeData } from '../types/bus';

export const REALTIME_DATA_KEY = ['bus', 'realtime'] as const;

export function useRealtimeData(
  dataEndpoint: string | undefined,
  refreshInterval = 15,
) {
  return useQuery<RealtimeData>({
    queryKey: [...REALTIME_DATA_KEY, dataEndpoint],
    queryFn: async () => {
      const result = await safeGet(dataEndpoint!, parseRealtimeData);

      if (result.ok) {
        return result.data;
      }

      throw result.failure;
    },
    enabled: !!dataEndpoint,
    refetchInterval: refreshInterval * 1000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}
