/**
 * Department list query for the Notices feature.
 *
 * Fetches `GET /notices/departments` and filters to the crawler-enabled
 * whitelist (see `notices/constants.ts`).
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseDepartmentList } from '../notices/parser';
import type { Department } from '../notices/types';

export const NOTICE_DEPARTMENTS_KEY = ['notices', 'departments'] as const;

export function useNoticeDepartments() {
  return useQuery<Department[]>({
    queryKey: NOTICE_DEPARTMENTS_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.noticesDepartments(),
        parseDepartmentList,
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    staleTime: 30 * 60_000,
  });
}
