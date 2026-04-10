/**
 * Single notice detail query.
 *
 * Fetches `GET /notices/:deptId/:articleNo`. Enabled only when both params
 * are provided.
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseNoticeDetail } from '../notices/parser';
import type { NoticeDetail } from '../notices/types';

export const NOTICE_DETAIL_KEY = ['notices', 'detail'] as const;

export function useNoticeDetail(
  deptId: string | null,
  articleNo: number | null,
) {
  return useQuery<NoticeDetail>({
    queryKey: [...NOTICE_DETAIL_KEY, deptId, articleNo],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.noticeDetail(deptId!, articleNo!),
        parseNoticeDetail,
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: deptId != null && articleNo != null,
    staleTime: 10 * 60_000,
  });
}
