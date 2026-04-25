/**
 * Tab configuration query for the Notices feature.
 *
 * Fetches `GET /notices/tabs` — returns tab layout, types, picker department
 * lists, and localized labels. Replaces the old `useNoticeDepartments` hook.
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseTabsConfig } from '../notices/parser';
import type { NoticeTabsConfig } from '../notices/types';

export const NOTICE_TABS_KEY = ['notices', 'tabs'] as const;

export function useNoticeTabs() {
  return useQuery<NoticeTabsConfig>({
    queryKey: NOTICE_TABS_KEY,
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.noticesTabs(), parseTabsConfig);
      if (result.ok) return result.data;
      throw result.failure;
    },
    staleTime: 60 * 60_000, // 1 hour — matches server Cache-Control: max-age=3600
  });
}
