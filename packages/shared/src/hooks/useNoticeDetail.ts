/**
 * Single notice detail query.
 *
 * Fetches `GET /notices/:sourceId/:articleNo`. Enabled only when both params
 * are provided.
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseNoticeDetail } from '../notices/parser';
import type { NoticeDetail } from '../notices/types';

export const NOTICE_DETAIL_KEY = ['notices', 'detail'] as const;

export function useNoticeDetail(
  sourceId: string | null,
  articleNo: number | null,
) {
  return useQuery<NoticeDetail>({
    queryKey: [...NOTICE_DETAIL_KEY, sourceId, articleNo],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.noticeDetail(sourceId!, articleNo!),
        parseNoticeDetail,
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: sourceId != null && articleNo != null,
    staleTime: 10 * 60_000,
  });
}
