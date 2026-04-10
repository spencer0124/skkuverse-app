/**
 * Paginated notice list query for a single department.
 *
 * Uses cursor-based infinite query. Server contract:
 *   GET /notices/dept/:deptId?limit=20&type=…&cursor=…
 *   → { notices: [...], nextCursor: string | null, hasMore: boolean }
 */

import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseNoticePage } from '../notices/parser';
import type { NoticePage, NoticeSummaryType } from '../notices/types';

export const NOTICE_LIST_KEY = ['notices', 'dept'] as const;

const PAGE_LIMIT = 20;

export interface UseNoticeListArgs {
  deptId: string;
  type?: NoticeSummaryType;
  enabled?: boolean;
}

export function useNoticeList({
  deptId,
  type,
  enabled = true,
}: UseNoticeListArgs) {
  return useInfiniteQuery<
    NoticePage,
    Error,
    InfiniteData<NoticePage, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey: [...NOTICE_LIST_KEY, deptId, { type: type ?? 'all' }],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: PAGE_LIMIT };
      if (type) params.type = type;
      if (pageParam) params.cursor = pageParam;
      const result = await safeGet(
        ApiEndpoints.noticesByDept(deptId),
        parseNoticePage,
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: enabled && deptId.length > 0,
    staleTime: 2 * 60_000,
  });
}
