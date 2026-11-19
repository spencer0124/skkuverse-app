import { useEffect, useEffectEvent } from 'react';
import {
  getAnalytics,
  logEvent as fbLogEvent,
  logScreenView as fbLogScreenView,
  setAnalyticsCollectionEnabled,
  setDefaultEventParameters,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';
import { getCrashlytics, log } from '@react-native-firebase/crashlytics';
import type { Campus, TabRoute } from '@skkuverse/shared';
import {
  firstSinceLaunch,
  foreignParams,
  notifPermValue,
  sanitizeParams,
  tabSwitchCause,
  type EntrySource,
  type NotifPerm,
  type Params,
  type TabSwitchCause,
  type TabSwitchMark,
  type ViewName,
} from './analytics.rules';
import type {
  BusContentType, CampusContentType, EventMap, LogAuthEventInputs, LogBuildingViewInputs,
  LogBusRouteOpenInputs, LogHomeContentSelectInputs, LogIntroStepInputs, LogNoticeViewInputs,
  LogNotificationTabToggleInputs, LogOnboardingStepInputs, LogSearchPerformInputs, LogSearchResultTapInputs,
  LogSettingsActionInputs, MealsContentType, NoticesContentType, SduiContentType, SearchContentType,
  SettingsContentType, ViewOpenExtra,
} from './analytics.types';
import { releaseContext } from './ota';

const DEBUG = __DEV__ && process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === '1';
const SEND = !__DEV__ || DEBUG;

/** QUIRK(react-native-firebase): the collection setting persists on the device, so it is set both ways. */
export async function disableAnalyticsInDev() {
  if (!__DEV__) return;
  await setAnalyticsCollectionEnabled(getAnalytics(), DEBUG);
}

export function setAnalyticsContext() {
  if (!SEND) return;
  const context = releaseContext();
  setDefaultEventParameters(getAnalytics(), { ...context }).catch(() => {});
  setUserProperty(getAnalytics(), 'app_channel', context.app_channel).catch(() => {});
}

let firstLaunch = false;

/**
 * WHY: decided once at init, before the engagement store stamps the launch, so a first-launch failure
 * rate has its own series.
 */
export function markFirstLaunch(value: boolean) {
  firstLaunch = value;
}

export function isFirstLaunch(): boolean {
  return firstLaunch;
}

let sentNotifPerm: NotifPerm | undefined;

/**
 * QUIRK(react-native-firebase): pass a fresh OS read, never a stored answer: on Android a stored one may
 * come from `requestPermission()`, which reports AUTHORIZED without the runtime permission.
 */
export function syncNotificationPermission(status: Parameters<typeof notifPermValue>[0]) {
  if (!SEND) return;
  const value = notifPermValue(status);
  if (value === sentNotifPerm) return;
  sentNotifPerm = value;
  setUserProperty(getAnalytics(), 'notif_perm', value).catch(() => {});
}

function truncate(s: string, maxLen = 100): string {
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

function logEvent(name: string, params: Params) {
  if (!SEND) return;
  const sent = sanitizeParams(params);
  // QUIRK(react-native-firebase): `logEvent` is synchronous: bad input throws here, and the SDK drops a native failure.
  try {
    fbLogEvent(getAnalytics(), name, sent);
  } catch {
    // WHY: never throw from logging.
  }
  // WHY: a crash report then shows the last things the user did.
  try {
    const id = sent.item_id ?? sent.game_id ?? sent.content_type;
    log(getCrashlytics(), id === undefined ? `ev:${name}` : `ev:${name} ${id}`);
  } catch {
    // WHY: never throw from logging.
  }
}

/**
 * WHY: module scope, so the clock starts as the bundle evaluates, after the native start-up.
 * SEE: docs/decisions/0022-places-open-on-the-map-intents-start-in-transit.md ("Measuring it")
 */
export const firstTransitTapMs = firstSinceLaunch(Date.now());

export function track<K extends keyof EventMap>(name: K, params: EventMap[K]) {
  logEvent(name, params);
}

export function setAnalyticsUserId(uid: string | null) {
  if (!SEND) return;
  setUserId(getAnalytics(), uid).catch(() => {});
}

export function setPreferredCampus(campus: Campus) {
  if (!SEND) return;
  setUserProperty(getAnalytics(), 'preferred_campus', campus).catch(() => {});
}

export function setAppLanguage(lang: string) {
  if (!SEND) return;
  setUserProperty(getAnalytics(), 'app_language', lang).catch(() => {});
}

export function setAuthState(state: 'anon' | 'google' | 'signed_out') {
  if (!SEND) return;
  setUserProperty(getAnalytics(), 'auth_state', state).catch(() => {});
}

let lastTab: string | undefined;
let tabVisit = 0;
let tabSwitchMark: TabSwitchMark | null = null;

export function currentTabVisit(): number {
  return tabVisit;
}

/** WHY: call it just before an app-made tab switch navigates, so the `tab_switch` it causes carries `cause`. */
export function markTabSwitch(tab: TabRoute, cause: TabSwitchCause) {
  tabSwitchMark = { tab, cause, at: Date.now() };
}

/**
 * QUIRK(react-navigation): focus callbacks fire on every return to a tab and every navigation inside one,
 * so a repeat of the current tab is dropped. WHY: the native-tab shell passes `withCause: false`, so its
 * rows stay comparable with installed builds.
 */
export function logTabSwitch(tabName: string, { withCause = true }: { withCause?: boolean } = {}) {
  if (tabName === lastTab) return;
  lastTab = tabName;
  tabVisit += 1;
  const cause = withCause ? tabSwitchCause(tabSwitchMark, tabName, Date.now()) : undefined;
  tabSwitchMark = null;
  logEvent('tab_switch', { tab_name: tabName, ...(cause && { cause }) });
}

export function logCampusSwitch(campus: string) {
  logEvent('campus_switch', { campus });
}

/** WHY: a user's own toggle only; a chip that switches layers logs one `map_chip`, not one of these per layer. */
export function logLayerToggle(layerId: string, visible: boolean) {
  logEvent('layer_toggle', { layer_id: layerId, visible: visible ? 'true' : 'false' });
}

export function logMarkerTap(skkuId: number) {
  logEvent('marker_tap', { skku_id: skkuId });
}

export function logBuildingView(params: LogBuildingViewInputs) {
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

export function logSearchPerform(params: LogSearchPerformInputs) {
  logEvent('search_perform', {
    query: truncate(params.query),
    building_results: params.buildingResults,
    space_results: params.spaceResults,
    ...(params.stopResults != null && { stop_results: params.stopResults }),
    ...(params.stationResults != null && { station_results: params.stationResults }),
    campus_filter: params.campusFilter ?? 'all',
  });
}

export function logSearchResultTap(params: LogSearchResultTapInputs) {
  logEvent('search_result_tap', {
    result_type: params.resultType,
    result_name: truncate(params.resultName),
    // WHY: Firebase takes no null, and an absent key would read as an older build that never sent one.
    campus: params.campus ?? 'unknown',
    ...(params.skkuId != null && { skku_id: params.skkuId }),
    ...(params.stopId != null && { stop_id: params.stopId }),
    ...(params.stationId != null && { station_id: params.stationId }),
  });
}

export function logSearchFilterChange(filter: string) {
  logEvent('search_filter_change', { filter });
}

export function logBusRouteOpen(params: LogBusRouteOpenInputs) {
  logEvent('bus_route_open', {
    route_id: params.routeId,
    route_label: truncate(params.routeLabel),
    screen_type: params.screenType,
    source: params.source,
  });
}

export function logBusServiceSwitch(routeId: string, serviceId: string) {
  logEvent('bus_service_switch', { route_id: routeId, service_id: serviceId });
}

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

export function logNoticeView(params: LogNoticeViewInputs) {
  logEvent('notice_view', {
    source_id: params.sourceId,
    article_no: params.articleNo,
    ...(params.tabKey && { tab_key: params.tabKey }),
  });
}

export function logReviewPromptShown(params: { reason: string; count: number }) {
  logEvent('review_prompt_shown', {
    reason: params.reason,
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

/** QUIRK(ios): logged as the prompt is requested, not shown; iOS skips it silently over its quota. */
export function logReviewNativeCalled(params: { reason: string; available: boolean }) {
  logEvent('review_native_called', {
    reason: params.reason,
    available: params.available ? 'true' : 'false',
  });
}

export function logScreenView(screenName: string) {
  if (!SEND) return;
  fbLogScreenView(getAnalytics(), { screen_name: screenName, screen_class: screenName }).catch(() => {});
}

export function logHomeContentSelect(params: LogHomeContentSelectInputs) {
  logEvent('select_content', {
    content_type: params.content_type,
    item_id: truncate(params.item_id),
  });
}

/** WHY: one GA4 `select_content` event; a wrapper per surface exists for its types, not a new event name. */
function logSelectContent(content_type: string, item_id: string) {
  logEvent('select_content', { content_type, item_id: truncate(item_id) });
}

export function logNoticesContentSelect(params: { content_type: NoticesContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export function logBusContentSelect(params: { content_type: BusContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export function logCampusContentSelect(params: { content_type: CampusContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export function logSearchContentSelect(params: { content_type: SearchContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export function logSettingsContentSelect(params: { content_type: SettingsContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export function logSduiContentSelect(params: { content_type: SduiContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

export function logMealsContentSelect(params: { content_type: MealsContentType; item_id: string }) {
  logSelectContent(params.content_type, params.item_id);
}

/**
 * WHY: one GA4 event name for every page event: a page names its events freely, and each as its own
 * event would spend the event-name quota on strings the app never reviewed.
 */
export function logMiniAppEvent(params: { miniAppId: string; event: string; params?: unknown }) {
  logEvent('miniapp_event', {
    ...foreignParams(params.params),
    miniapp_id: truncate(params.miniAppId),
    event: truncate(params.event),
  });
}

/** WHY: the only trace of a stale or mistyped place id; the map lands with no sheet and nothing says why. */
export function logMapPlaceNotFound(params: { placeId: string }) {
  logEvent('map_place_not_found', { place_id: truncate(params.placeId) });
}

export function logOnboardingStep(params: LogOnboardingStepInputs) {
  logEvent('onboarding_step', {
    step: params.step,
    action: params.action,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}

export function logIntroStep(params: LogIntroStepInputs) {
  logEvent('intro_step', {
    step: params.step,
    action: params.action,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}

export function logNotificationTabToggle(params: LogNotificationTabToggleInputs) {
  logEvent('notification_tab_toggle', {
    tab_key: params.tab_key,
    enabled: params.enabled ? 'true' : 'false',
    source: params.source,
  });
}

export function logSettingsAction(params: LogSettingsActionInputs) {
  logEvent('settings_action', {
    action: params.action,
    ...(params.detail && { detail: truncate(params.detail) }),
  });
}

export function logAuthEvent(params: LogAuthEventInputs) {
  logEvent('auth_event', {
    event: params.event,
    surface: params.surface,
    ...(params.detail && { detail: truncate(params.detail) }),
    ...(params.cls && { cls: params.cls }),
    ...(params.ac_kind && { ac_kind: params.ac_kind }),
  });
}

/**
 * WHY: `source` is read as the view opens, so set it in the same update as the item; `onOpen` runs once
 * per open, the place to bump a counter. The dwell is wall time, background included.
 */
export function useViewTracking(
  view: ViewName,
  itemId: string | null,
  source: EntrySource,
  onOpen?: (itemId: string) => ViewOpenExtra,
) {
  // WHY: an effect event, so a new `source` or `onOpen` closure never logs a close and a reopen.
  const logOpen = useEffectEvent((id: string) => {
    track('view_open', { view, item_id: id, source, ...onOpen?.(id) });
  });

  useEffect(() => {
    if (itemId === null) return;
    const openedAt = Date.now();
    logOpen(itemId);
    return () => track('view_close', { view, item_id: itemId, dwell_ms: Date.now() - openedAt });
  }, [view, itemId]);
}
