import analytics from '@react-native-firebase/analytics';

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

// ── Screen View (manual) ───────────────────────────────────────────

export function logScreenView(screenName: string) {
  if (__DEV__) return;
  analytics()
    .logScreenView({ screen_name: screenName, screen_class: screenName })
    .catch(() => {});
}
