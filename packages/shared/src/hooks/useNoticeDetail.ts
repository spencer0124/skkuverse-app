/**
 * Single notice detail query.
 *
 * Fetches `GET /notices/:sourceId/:articleNo`. Enabled only when both params
 * are provided.
 *
 * Error type is narrowed to `AppFailure` (not the default `Error`) so
 * callers can branch on `error.type === 'server' && error.statusCode === 404`
 * — the deleted-notice tombstone path in the detail screen relies on this.
 * Server returns 404 for missing or `isDeleted: true` notices (server doc
 * §3.15: client distinguishes via the existing bookmark cache, not a
 * tombstone payload field).
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseNoticeDetail } from '../notices/parser';
import type { NoticeDetail } from '../notices/types';
import type { AppFailure } from '../api/types';

export const NOTICE_DETAIL_KEY = ['notices', 'detail'] as const;

export function useNoticeDetail(
  sourceId: string | null,
  articleNo: number | null,
) {
  return useQuery<NoticeDetail, AppFailure>({
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
