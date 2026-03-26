/**
 * Main notice placement hook.
 *
 * Fetches ad placements and extracts the `main_notice` placement.
 * Used by transit tab to show the notice banner above the bus list.
 *
 * Flutter source: lib/features/app_shell/controller/app_shell_controller.dart
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import type { ApiEnvelope } from '../api/types';

export interface NoticePlacement {
  text: string;
  linkUrl: string;
  enabled: boolean;
}

type Raw = Record<string, unknown>;

function parseMainNotice(envelope: ApiEnvelope<unknown>): NoticePlacement | null {
  const data = envelope.data as Raw;
  const notice = data['main_notice'] as Raw | null;
  if (!notice || !(notice.enabled as boolean)) return null;
  return {
    text: (notice.text as string) ?? '',
    linkUrl: (notice.linkUrl as string) ?? '',
    enabled: true,
  };
}

export const MAIN_NOTICE_KEY = ['ad', 'mainNotice'] as const;

export function useMainNotice() {
  return useQuery<NoticePlacement | null>({
    queryKey: MAIN_NOTICE_KEY,
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.adPlacements(), parseMainNotice);

      if (result.ok) {
        return result.data;
      }

      // Notice is non-critical — return null on failure
      return null;
    },
    staleTime: 5 * 60_000,
  });
}
