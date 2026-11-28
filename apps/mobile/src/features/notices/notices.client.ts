// SEE: docs/decisions/0020-app-architecture.md (D1): one client for the server's /notices module.
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  ApiEndpoints,
  API_TIMEOUT_MS,
  parseOrThrow,
  safeGet,
  type AppFailure,
} from '@skkuverse/shared';
import { multiSourceNoticePageSchema, noticeDetailSchema, noticePageSchema, noticeTabsSchema } from './notices.schema';
import { canRequestOverview, normalizeOverviewQuery } from './overview/overview.rules';
import { parseNoticeOverview } from './overview/overview.schema';
import dummyDetails from './__fixtures__/notice-briefs.json';
import type { NoticeDetail, NoticePage, NoticeTabsConfig } from './notices.types';
import type { NoticeOverviewResult } from './overview/overview.types';

export const NOTICE_LIST_KEY = ['notices', 'source'] as const;
export const NOTICE_MULTI_KEY = ['notices', 'multi'] as const;
export const NOTICE_DETAIL_KEY = ['notices', 'detail'] as const;
export const NOTICE_TABS_KEY = ['notices', 'tabs'] as const;
export const NOTICE_OVERVIEW_KEY = ['notices', 'overview'] as const;

const PAGE_LIMIT = 20;

export interface NoticeListInputs {
  sourceId: string;
  q?: string;
  enabled?: boolean;
}

export interface MultiSourceNoticeListInputs {
  sourceIds: string[];
  q?: string;
  enabled?: boolean;
}

export interface NoticeOverviewInputs {
  q: string | undefined;
  sourceIds: readonly string[];
  enabled?: boolean;
}

export function noticeListQueryOptions({ sourceId, q, enabled = true }: NoticeListInputs) {
  return infiniteQueryOptions<
    NoticePage,
    Error,
    InfiniteData<NoticePage, string | null>,
    readonly unknown[],
    string | null
  >({
    // WHY: q is part of the key, so two searches never share a cache.
    queryKey: [...NOTICE_LIST_KEY, sourceId, { type: 'all', q: q ?? '' }],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: PAGE_LIMIT };
      if (q) params.q = q;
      if (pageParam) params.cursor = pageParam;
      const result = await safeGet(
        ApiEndpoints.noticesBySource(sourceId),
        (envelope) => parseOrThrow(noticePageSchema, envelope.data, 'GET /notices/source/:sourceId'),
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: enabled && sourceId.length > 0,
    staleTime: 2 * 60_000,
    // WHY: the previous query's results stay up while a new q goes through
    // debounce and network, so the SectionList chain root never unmounts
    // (iOS 26 minimize) and the skeleton does not flash on every keystroke.
    placeholderData: keepPreviousData,
  });
}

export function multiSourceNoticeListQueryOptions({
  sourceIds,
  q,
  enabled = true,
}: MultiSourceNoticeListInputs) {
  // WHY: sorted, so the cache key does not depend on the caller's order.
  const sortedKey = sourceIds.slice().sort().join(',');

  return infiniteQueryOptions<
    NoticePage,
    Error,
    InfiniteData<NoticePage, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey: [...NOTICE_MULTI_KEY, sortedKey, { type: 'all', q: q ?? '' }],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = {
        limit: PAGE_LIMIT,
        sourceIds: sortedKey,
      };
      if (q) params.q = q;
      if (pageParam) params.cursor = pageParam;
      const result = await safeGet(
        ApiEndpoints.noticesMulti(),
        (envelope) => parseOrThrow(multiSourceNoticePageSchema, envelope.data, 'GET /notices'),
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: enabled && sourceIds.length > 0,
    staleTime: 2 * 60_000,
    // WHY: as the single-source list: the chain root stays mounted across q changes.
    placeholderData: keepPreviousData,
  });
}

/** WHY: the error is the `AppFailure`, so the detail can tell a deleted notice's 404 from the rest. */
export function noticeDetailQueryOptions(sourceId: string | null, articleNo: number | null) {
  return queryOptions<NoticeDetail, AppFailure>({
    queryKey: [...NOTICE_DETAIL_KEY, sourceId, articleNo],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.noticeDetail(sourceId!, articleNo!),
        (envelope) => parseOrThrow(noticeDetailSchema, envelope.data, 'GET /notices/:sourceId/:articleNo'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: sourceId != null && articleNo != null,
    staleTime: 10 * 60_000,
  });
}

/** WHY: the server does not send the next detail wire yet, so a debug build opens these dummies by their notice path. */
export function dummyNoticeDetail(sourceId: string, articleNo: number): NoticeDetail | null {
  if (!__DEV__) return null;
  const raw = dummyDetails.find((detail) => detail.sourceId === sourceId && detail.articleNo === articleNo);
  return raw === undefined ? null : parseOrThrow(noticeDetailSchema, raw, 'notices.dummy');
}

export function noticeTabsQueryOptions() {
  return queryOptions<NoticeTabsConfig>({
    queryKey: NOTICE_TABS_KEY,
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.noticesTabs(), (envelope) =>
        parseOrThrow(noticeTabsSchema, envelope.data, 'GET /notices/tabs'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    // CONTRACT(skkuverse-server): skkuverse-server/src/notices/tabs/notices-tabs.constants.ts sends
    // `Cache-Control: private, max-age=3600`.
    staleTime: 60 * 60_000,
  });
}

function sortedSourceIds(sourceIds: readonly string[]): string {
  return [...sourceIds].sort().join(',');
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/notices-api.md asks for a 25 s timeout (the
 * server waits up to 24 s on the LLM) and no retry of any kind, since each retry is another LLM call.
 */
export async function fetchNoticeOverview(
  q: string,
  sourceIds: readonly string[],
  signal?: AbortSignal,
): Promise<NoticeOverviewResult> {
  const result = await safeGet(ApiEndpoints.noticesOverview(), parseNoticeOverview, {
    params: { q: q.trim(), sourceIds: sortedSourceIds(sourceIds) },
    timeout: API_TIMEOUT_MS.overview,
    'axios-retry': { retries: 0 },
    signal,
  });
  if (result.ok) return result.data;
  throw result.failure;
}

/** WHY: the caller enables it on submit only; this adds the server's own validation. */
export function noticeOverviewQueryOptions({ q, sourceIds, enabled = true }: NoticeOverviewInputs) {
  const sortedKey = sortedSourceIds(sourceIds);
  const normalized = q === undefined ? '' : normalizeOverviewQuery(q);

  return queryOptions<NoticeOverviewResult, AppFailure>({
    queryKey: [...NOTICE_OVERVIEW_KEY, sortedKey, normalized],
    queryFn: ({ signal }) => fetchNoticeOverview(q ?? '', sourceIds, signal),
    enabled: enabled && q !== undefined && canRequestOverview(q, sourceIds),
    // WHY: the route sends no Cache-Control, so nothing may be held as fresh.
    // A resubmit shows the held answer at once and asks again; the server's
    // 30-minute cache answers that quickly.
    staleTime: 0,
    // WHY: QueryProvider turns an app foreground into a focus refetch, which
    // would ask the LLM again and could swap the answer under the reader.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
