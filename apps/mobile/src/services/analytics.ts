import analytics from '@react-native-firebase/analytics';
import type { Campus, NoticeSummaryType } from '@skkuverse/shared';

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
  campus: Campus;
  source: BuildingDetailSource;
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

/** Where a building detail sheet was opened from. */
export type BuildingDetailSource = 'marker' | 'search' | 'connection' | 'direct';

export type SearchResultType = 'building' | 'space';

export function logSearchResultTap(params: {
  resultType: SearchResultType;
  resultName: string;
  /** null when the result carried no campus (space results). */
  campus: Campus | null;
  skkuId?: number;
}) {
  logEvent('search_result_tap', {
    result_type: params.resultType,
    result_name: truncate(params.resultName),
    // Firebase params take no null, and omitting the key would make "no campus"
    // indistinguishable from an older build that never sent one.
    campus: params.campus ?? 'unknown',
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
    // Generic 'trigger_count' (was 'bookmark_count') — covers both bookmark
    // and shuttle surfaces. Existing GA4 dimension renamed; data before this
    // change used the old key but funnel is queryable via `reason` split.
    trigger_count: params.count,
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

/**
 * `available: false` fires when StoreReview.isAvailableAsync() returns false
 * (Android without Play Services, certain China builds). We log it as a
 * separate signal so the funnel can distinguish "OS skipped the prompt"
 * (silent on iOS quota) from "we never asked because the API was missing".
 */
export function logReviewNativeCalled(params: { reason: string; available: boolean }) {
  logEvent('review_native_called', {
    reason: params.reason,
    available: params.available ? 'true' : 'false',
  });
}

// ── Screen View (manual) ───────────────────────────────────────────

export function logScreenView(screenName: string) {
  if (__DEV__) return;
  analytics()
    .logScreenView({ screen_name: screenName, screen_class: screenName })
    .catch(() => {});
}

// ── Home Content Selection (GA4 recommended select_content) ────────

/**
 * Home screen click tracking via GA4 recommended `select_content` event
 * (prescribed params: content_type + item_id). content_type discriminates
 * the interaction surface (hero / tile / notice_row / news_card / ...);
 * item_id identifies the specific target within that surface.
 */
export type HomeContentType =
  | 'profile'
  | 'settings'
  | 'hero'
  | 'tile'
  | 'notice_more'
  | 'notice_row'
  | 'news_more'
  | 'news_card'
  | 'news_modal_close'
  | 'onboarding_cta';

export function logHomeContentSelect(params: {
  content_type: HomeContentType;
  item_id: string;
}) {
  logEvent('select_content', {
    content_type: params.content_type,
    item_id: truncate(params.item_id),
  });
}

// ── Per-feature select_content wrappers ────────────────────────────
// All emit GA4 recommended `select_content` event; per-feature wrapper
// exists for type safety + grep affordance, not for separate event names.

function logSelectContent(content_type: string, item_id: string) {
  logEvent('select_content', { content_type, item_id: truncate(item_id) });
}

export type NoticesContentType =
  | 'tab_strip'
  | 'list_row'
  | 'header_bookmark'
  | 'header_bell'
  | 'accessory_search'
  | 'picker_done'
  | 'picker_close'
  | 'picker_row'
  | 'picker_chip_remove'
  | 'picker_unsupported'
  | 'search_back'
  | 'detail_share'
  | 'detail_open_original'
  | 'detail_view_source'
  | 'detail_sibling_prev'
  | 'detail_sibling_next'
  | 'detail_attachment_preview'
  | 'detail_attachment_download'
  | 'detail_markdown_link'
  | 'detail_markdown_contact'
  | 'onboarding_landing_cta'
  | 'onboarding_landing_signin';
export function logNoticesContentSelect(params: { content_type: NoticesContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export type BusContentType =
  | 'schedule_day'
  | 'schedule_week_prev'
  | 'schedule_week_next'
  | 'schedule_info'
  | 'realtime_info'
  | 'realtime_refresh';
export function logBusContentSelect(params: { content_type: BusContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export type CampusContentType =
  | 'filter_button'
  | 'search_bar'
  | 'quick_action_building_map'
  | 'quick_action_building_code'
  | 'quick_action_lost_found'
  | 'filter_sheet_campus_pill'
  | 'building_desc_expand'
  // One event per tap, carrying the chip id. Deliberately NOT accompanied by a
  // `logLayerToggle` per layer the chip switched: one tap would emit five layer
  // events and drown the signal the user actually gave.
  | 'map_chip'
  | 'eventmap_chip'
  | 'eventmap_filter_chip'
  | 'eventmap_sort'
  | 'eventmap_list_button'
  | 'eventmap_list_row';
export function logCampusContentSelect(params: { content_type: CampusContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export type SearchContentType =
  | 'clear_button'
  | 'section_buildings_toggle'
  | 'section_spaces_toggle';
export function logSearchContentSelect(params: { content_type: SearchContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export type SettingsContentType =
  | 'row_account'
  | 'row_notifications'
  | 'row_kakao'
  | 'row_licenses'
  | 'row_oss'
  | 'row_attributions'
  | 'row_tos'
  | 'row_debug_logs'
  | 'signin_from_account_anon';
export function logSettingsContentSelect(params: { content_type: SettingsContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export type SduiContentType = 'banner' | 'notice_widget' | 'button_grid_item';
export function logSduiContentSelect(params: { content_type: SduiContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

// ── Custom typed wrappers (funnel / state change) ──────────────────

/**
 * Onboarding 7-step wizard funnel. step + action lets dashboard reconstruct
 * drop-off rates per step and which action types preceded exit.
 */
export type OnboardingStepKey =
  | 'campus'
  | 'primary_dept'
  | 'interest_dept'
  | 'login'
  | 'notification'
  | 'notice_categories'
  | 'completion';
export type OnboardingAction =
  | 'enter'
  | 'advance'
  | 'back'
  | 'skip'
  | 'exit_cancel'
  | 'exit_leave'
  | 'select_campus'
  | 'select_primary_dept'
  | 'open_unsupported_sheet'
  | 'select_unsupported_umbrella'
  | 'go_dept_survey'
  | 'toggle_interest_dept'
  | 'clear_interest_depts'
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_error'
  | 'permission_grant'
  | 'permission_deny'
  | 'toggle_category'
  | 'complete';
export function logOnboardingStep(params: {
  step: OnboardingStepKey;
  action: OnboardingAction;
  detail?: string;
}) {
  logEvent('onboarding_step', {
    step: params.step,
    action: params.action,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}

/**
 * First-launch intro funnel. A separate event from `onboarding_step` on
 * purpose: the intro is a marketing tour every anonymous user sees, while the
 * 7-step wizard is a configuration flow only notices-tab users reach. Merging
 * them would make wizard drop-off unreadable.
 */
export type IntroStepKey = 'shuttle' | 'map' | 'notices' | 'login';
export type IntroAction =
  | 'enter'
  | 'advance'
  | 'skip'
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_error';
export function logIntroStep(params: {
  step: IntroStepKey;
  action: IntroAction;
  detail?: string;
}) {
  logEvent('intro_step', {
    step: params.step,
    action: params.action,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}

/** Notification tab toggle (settings or onboarding screen). */
export function logNotificationTabToggle(params: {
  tab_key: string;
  enabled: boolean;
  source: 'settings' | 'onboarding';
}) {
  logEvent('notification_tab_toggle', {
    tab_key: params.tab_key,
    enabled: params.enabled ? 'true' : 'false',
    source: params.source,
  });
}

/** Settings destructive / retention-sensitive actions. */
export type SettingsActionKey =
  | 'sign_out_prompt'
  | 'sign_out_confirm'
  | 'sign_out_cancel'
  | 'delete_account_prompt'
  | 'delete_account_confirm'
  | 'delete_account_cancel'
  | 'delete_feedback_submit'
  | 'delete_feedback_skip';
export function logSettingsAction(params: {
  action: SettingsActionKey;
  detail?: string;
}) {
  logEvent('settings_action', {
    action: params.action,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}

/** Auth events from login / onboarding / account-settings / notices-landing. */
export type AuthEvent =
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_cancel'
  | 'signin_domain_rejected'
  | 'signin_error';
export type AuthSurface =
  | 'login_screen'
  | 'onboarding'
  | 'account_settings'
  | 'notices_landing';
export function logAuthEvent(params: {
  event: AuthEvent;
  surface: AuthSurface;
  detail?: string;
}) {
  logEvent('auth_event', {
    event: params.event,
    surface: params.surface,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}
