import analytics from '@react-native-firebase/analytics';
import type { NoticeSummaryType } from '@skkuverse/shared';

/**
 * Centralized analytics service — fire-and-forget wrapper around Firebase Analytics.
 *
 * - Dev/prod collection controlled via firebase.json (analytics_auto_collection_enabled)
 * - __DEV__ guard on each function as additional safety net
 * - All calls silently swallow errors (analytics must never crash the app)
 * - String params truncated to 100 chars (Firebase limit)
 *
 * Flutter source: lib/core/services/analytics_service.dart
 */

// ── Init ──────────────────────────────────────────────────────────

/** 개발 모드에서 Analytics 자동 수집 비활성화. 앱 초기화 시 1회 호출. */
export async function disableAnalyticsInDev() {
  if (!__DEV__) return;
  await analytics().setAnalyticsCollectionEnabled(false);
}

// ── Helpers ────────────────────────────────────────────────────────

function truncate(s: string, maxLen = 100): string {
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

function logEvent(name: string, params: Record<string, string | number>) {
  if (__DEV__) return;
  analytics().logEvent(name, params).catch(() => {});
}

// ── User ID & Properties ───────────────────────────────────────────

export function setAnalyticsUserId(uid: string | null) {
  if (__DEV__) return;
  analytics().setUserId(uid).catch(() => {});
}

export function setPreferredCampus(campus: string) {
  if (__DEV__) return;
  analytics().setUserProperty('preferred_campus', campus).catch(() => {});
}

export function setAppLanguage(lang: string) {
  if (__DEV__) return;
  analytics().setUserProperty('app_language', lang).catch(() => {});
}

// ── Tab Navigation ─────────────────────────────────────────────────

export function logTabSwitch(tabName: string) {
  logEvent('tab_switch', { tab_name: tabName });
}

// ── Campus Map ─────────────────────────────────────────────────────

export function logCampusSwitch(campus: string) {
  logEvent('campus_switch', { campus });
}

export function logLayerToggle(layerId: string, visible: boolean) {
  logEvent('layer_toggle', { layer_id: layerId, visible: visible ? 'true' : 'false' });
}

export function logMarkerTap(skkuId: number) {
  logEvent('marker_tap', { skku_id: skkuId });
}

// ── Building Detail ────────────────────────────────────────────────

export function logBuildingView(params: {
  skkuId: number;
  buildingName: string;
  campus: string;
  source: string;
}) {
  logEvent('building_view', {
    skku_id: params.skkuId,
    building_name: truncate(params.buildingName),
    campus: params.campus,
    source: params.source,
  });
}

export function logFloorExpand(skkuId: number, floorName: string) {
  logEvent('floor_expand', { skku_id: skkuId, floor_name: floorName });
}

export function logSpaceShowAll(skkuId: number, floorName: string) {
  logEvent('space_show_all', { skku_id: skkuId, floor_name: floorName });
}

export function logConnectionTap(fromSkkuId: number, targetSkkuId: number) {
  logEvent('connection_tap', { from_skku_id: fromSkkuId, target_skku_id: targetSkkuId });
}

export function logConnectionMapOpen(campus: string) {
  logEvent('connection_map_open', { campus });
}

// ── Search ─────────────────────────────────────────────────────────

export function logSearchPerform(params: {
  query: string;
  buildingResults: number;
  spaceResults: number;
  campusFilter?: string;
}) {
  logEvent('search_perform', {
    query: truncate(params.query),
    building_results: params.buildingResults,
    space_results: params.spaceResults,
    campus_filter: params.campusFilter ?? 'all',
  });
}

export function logSearchResultTap(params: {
  resultType: string;
  resultName: string;
  campus: string;
  skkuId?: number;
}) {
  logEvent('search_result_tap', {
    result_type: params.resultType,
    result_name: truncate(params.resultName),
    campus: params.campus,
    ...(params.skkuId != null && { skku_id: params.skkuId }),
  });
}

export function logSearchFilterChange(filter: string) {
  logEvent('search_filter_change', { filter });
}

// ── Transit / Bus ──────────────────────────────────────────────────

export function logBusRouteOpen(params: {
  routeId: string;
  routeLabel: string;
  screenType: string;
}) {
  logEvent('bus_route_open', {
    route_id: params.routeId,
    route_label: truncate(params.routeLabel),
    screen_type: params.screenType,
  });
}

export function logBusServiceSwitch(routeId: string, serviceId: string) {
  logEvent('bus_service_switch', { route_id: routeId, service_id: serviceId });
}

// ── Notice Bookmarks ───────────────────────────────────────────────

/**
 * Bookmark events. Phase 1 Chunk A defines the signatures; Chunk B wires the
 * call sites (toggle in NoticeDetailScreen, list-mount in saved.tsx). Adding
 * the events now is cheap and avoids backfill pain — without these, "how many
 * users bookmark notices" can't be answered until they ship.
 */
export function logBookmarkSave(params: { sourceId: string; articleNo: number }) {
  logEvent('bookmark_save', {
    source_id: params.sourceId,
    article_no: params.articleNo,
  });
}

export function logBookmarkUnsave(params: { sourceId: string; articleNo: number }) {
  logEvent('bookmark_unsave', {
    source_id: params.sourceId,
    article_no: params.articleNo,
  });
}

export function logBookmarksListOpen() {
  logEvent('bookmarks_list_open', {});
}

// ── Notice Detail / AI Summary ─────────────────────────────────────

/**
 * 노티스 상세 진입 이벤트. 라우트 마운트당 1회 발화. `has_summary`는 백엔드
 * AI 커버리지 모니터링용 — `notice_view` 대비 `notice_ai_summary_view`
 * 비율로 derived metric을 얻기 위해 별도 이벤트(`logAiSummaryView`)도
 * summary 존재 시 함께 발화한다.
 */
export function logNoticeView(params: {
  sourceId: string;
  articleNo: number;
  tabKey?: string;
  hasSummary: boolean;
  summaryType?: NoticeSummaryType;
}) {
  logEvent('notice_view', {
    source_id: params.sourceId,
    article_no: params.articleNo,
    has_summary: params.hasSummary ? 'true' : 'false',
    ...(params.tabKey && { tab_key: params.tabKey }),
    ...(params.summaryType && { summary_type: params.summaryType }),
  });
}

/**
 * AI 요약 카드 실제 노출 impression. `<SummaryCard>` 마운트(=서버가 summary를
 * 제공한 경우)에서만 발화. 백엔드가 추출한 필드 구성(`has_periods`,
 * `has_locations`, `has_details`)도 함께 보내 어느 메타데이터가 가장 자주
 * 채워지는지 트래킹.
 */
export function logAiSummaryView(params: {
  sourceId: string;
  articleNo: number;
  summaryType: NoticeSummaryType;
  hasOneLiner: boolean;
  hasPeriods: boolean;
  hasLocations: boolean;
  hasDetails: boolean;
  model?: string | null;
}) {
  logEvent('notice_ai_summary_view', {
    source_id: params.sourceId,
    article_no: params.articleNo,
    summary_type: params.summaryType,
    has_one_liner: params.hasOneLiner ? 'true' : 'false',
    has_periods: params.hasPeriods ? 'true' : 'false',
    has_locations: params.hasLocations ? 'true' : 'false',
    has_details: params.hasDetails ? 'true' : 'false',
    ...(params.model && { model: truncate(params.model) }),
  });
}

// ── Store Review Prompt ────────────────────────────────────────────

/**
 * Review prompt funnel — instrumented at every stage so we can measure:
 *   shown → positive → native_called    (the success path)
 *   shown → negative                    (filtered out before native)
 *   shown → dismissed                   (no engagement either way)
 *
 * `review_native_called` is logged at the moment we invoke
 * `StoreReview.requestReview()`, NOT when the system prompt actually shows.
 * iOS silently skips the prompt when over quota / in TestFlight, and there
 * is no JS callback for that. Treat the funnel rate (positive → native_called)
 * as the "we attempted to ask" rate, and compare against actual App Store
 * Connect / Play Console rating velocity to infer real exposure.
 */
export function logReviewPromptShown(params: { reason: string; count: number }) {
  logEvent('review_prompt_shown', {
    reason: params.reason,
    delighted_count: params.count,
  });
}

export function logReviewPromptPositive(params: { reason: string }) {
  logEvent('review_prompt_positive', { reason: params.reason });
}

export function logReviewPromptNegative(params: { reason: string; hasText: boolean }) {
  logEvent('review_prompt_negative', {
    reason: params.reason,
    has_text: params.hasText ? 'true' : 'false',
  });
}

export function logReviewPromptDismissed(params: { reason: string }) {
  logEvent('review_prompt_dismissed', { reason: params.reason });
}

export function logReviewNativeCalled(params: { reason: string }) {
  logEvent('review_native_called', { reason: params.reason });
}

// ── Screen View (manual) ───────────────────────────────────────────

export function logScreenView(screenName: string) {
  if (__DEV__) return;
  analytics()
    .logScreenView({ screen_name: screenName, screen_class: screenName })
    .catch(() => {});
}
