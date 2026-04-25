/**
 * Paginated notice list query across multiple sources.
 *
 * Uses cursor-based infinite query. Server contract:
 *   GET /notices?sourceIds=a,b&limit=20&type=…&cursor=…
 *   → { notices: [...], nextCursor: string | null, hasMore: boolean }
 *
 * sourceIds are sorted before joining to guarantee stable cache keys
 * regardless of the order the caller provides them.
 */

import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseNoticePage } from '../notices/parser';
import type { NoticePage, NoticeSummaryType } from '../notices/types';

export const NOTICE_MULTI_KEY = ['notices', 'multi'] as const;

const PAGE_LIMIT = 20;

export interface UseMultiSourceNoticeListArgs {
  sourceIds: string[];
  type?: NoticeSummaryType;
  enabled?: boolean;
}

export function useMultiSourceNoticeList({
  sourceIds,
  type,
  enabled = true,
}: UseMultiSourceNoticeListArgs) {
  const sortedKey = sourceIds.slice().sort().join(',');

  return useInfiniteQuery<
    NoticePage,
    Error,
    InfiniteData<NoticePage, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey: [...NOTICE_MULTI_KEY, sortedKey, { type: type ?? 'all' }],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = {
        limit: PAGE_LIMIT,
        sourceIds: sortedKey,
      };
      if (type) params.type = type;
      if (pageParam) params.cursor = pageParam;
      const result = await safeGet(
        ApiEndpoints.noticesMulti(),
        parseNoticePage,
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: enabled && sourceIds.length > 0,
    staleTime: 2 * 60_000,
  });
}
