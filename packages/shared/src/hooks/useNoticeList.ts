/**
 * Paginated notice list query for a single source.
 *
 * Uses cursor-based infinite query. Server contract:
 *   GET /notices/source/:sourceId?limit=20&type=…&cursor=…
 *   → { notices: [...], nextCursor: string | null, hasMore: boolean }
 */

import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { parseNoticePage } from '../notices/parser';
import type { NoticePage, NoticeSummaryType } from '../notices/types';

export const NOTICE_LIST_KEY = ['notices', 'source'] as const;

const PAGE_LIMIT = 20;

export interface UseNoticeListArgs {
  sourceId: string;
  type?: NoticeSummaryType;
  /** Optional case-insensitive search query — server applies regex on
   *  (title, summaryOneLiner). Empty/undefined skips the search clause. */
  q?: string;
  enabled?: boolean;
}

export function useNoticeList({
  sourceId,
  type,
  q,
  enabled = true,
}: UseNoticeListArgs) {
  return useInfiniteQuery<
    NoticePage,
    Error,
    InfiniteData<NoticePage, string | null>,
    readonly unknown[],
    string | null
  >({
    // q is part of the cache key — different queries get separate caches
    // and don't bleed results into each other.
    queryKey: [...NOTICE_LIST_KEY, sourceId, { type: type ?? 'all', q: q ?? '' }],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: PAGE_LIMIT };
      if (type) params.type = type;
      if (q) params.q = q;
      if (pageParam) params.cursor = pageParam;
      const result = await safeGet(
        ApiEndpoints.noticesBySource(sourceId),
        parseNoticePage,
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: enabled && sourceId.length > 0,
    staleTime: 2 * 60_000,
    // Keep the previous query's results visible while a new q transitions
    // through debounce + network. Without this, every keystroke flashes the
    // skeleton and SectionList may unmount, breaking the iOS 26 minimize
    // chain rule. With it, the list cross-fades and the chain root stays
    // mounted across q changes.
    placeholderData: keepPreviousData,
  });
}
