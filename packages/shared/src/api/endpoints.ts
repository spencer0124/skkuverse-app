/**
 * Centralized API path definitions.
 *
 * Paths are unencoded — axios handles percent-encoding automatically.
 *
 * Flutter source: lib/core/data/api_endpoints.dart
 */
export const ApiEndpoints = {
  // ── Campus shuttle ──
  campusEta: () => '/bus/campus/eta',

  // ── UI (Server-Driven) ──
  homeTransitList: () => '/ui/home/transitlist',
  homeScroll: () => '/ui/home/scroll',
  homeCampus: () => '/ui/home/campus',

  // ── Building ──
  buildingList: () => '/building/list',
  buildingSearch: () => '/building/search',
  buildingDetail: (skkuId: number) => `/building/${skkuId}`,

  // ── Ads ──
  adPlacements: () => '/ad/placements',
  adEvents: () => '/ad/events',

  // ── Bus config ──
  busConfig: () => '/bus/config',
  busConfigGroup: (groupId: string) => `/bus/config/${groupId}`,

  // ── Map ──
  mapConfig: () => '/map/config',

  // The event map has no endpoint of its own. Booths reach the app as ordinary
  // markers on whatever `/map/config` lists as a festival layer's `endpoint`,
  // which is why no `/eventmap/*` route appears here — there is none to call.

  // ── App config ──
  appConfig: () => '/app/config',

  // ── Mini-apps (server-owned registry) ──
  miniApps: () => '/miniapps',
  miniAppDetail: (id: string) => `/miniapps/${id}`,

  // ── Notices ──
  noticesTabs: () => '/notices/tabs',
  noticesBySource: (sourceId: string) => `/notices/source/${sourceId}`,
  noticesMulti: () => '/notices',
  noticeDetail: (sourceId: string, articleNo: number) =>
    `/notices/${sourceId}/${articleNo}`,
} as const;
