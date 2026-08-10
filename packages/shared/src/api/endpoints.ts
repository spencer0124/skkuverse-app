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
  aroundPlace: () => '/map/v1/getaroundplacedata',

  // ── Event map ──
  // Only the manifest is listed. The snapshot URL is formed server-side and
  // already carries `/:layerSetId/:version?lang=`; the client joins the
  // manifest's `snapshotUrl` to the base URL and never builds one itself.
  eventMapManifest: () => '/eventmap/manifest',

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
