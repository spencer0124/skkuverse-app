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

  // ── App config ──
  appConfig: () => '/app/config',

  // ── Notices ──
  noticesDepartments: () => '/notices/departments',
  noticesByDept: (deptId: string) => `/notices/dept/${deptId}`,
  noticesMulti: () => '/notices',
  noticeDetail: (deptId: string, articleNo: number) =>
    `/notices/${deptId}/${articleNo}`,
} as const;
