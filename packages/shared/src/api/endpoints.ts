// QUIRK(axios): a path goes out as written, since axios percent-encodes only `params`; encode any
// segment the server's slug grammar does not already bound.
export const ApiEndpoints = {
  /** WHY: `/ui/home/transitlist` stays frozen for installed builds, so new fields go to this path. */
  homeTransit: () => '/ui/home/transit',
  homeScroll: () => '/ui/home/scroll',
  homeCampus: () => '/ui/home/campus',
  homeLayout: () => '/ui/home',

  buildingList: () => '/building/list',
  buildingSearch: () => '/building/search',
  buildingDetail: (skkuId: number) => `/building/${skkuId}`,

  busConfig: () => '/bus/config',
  busConfigGroup: (groupId: string) => `/bus/config/${groupId}`,
  busStops: () => '/bus/stops',
  busStopArrivals: (stopId: string) => `/bus/stops/${stopId}/arrivals`,

  subwayStations: () => '/subway/stations',
  subwayArrivals: (stationId: string) => `/subway/stations/${stationId}/arrivals`,

  meals: (campus: string, date: string) => `/meals?campus=${campus}&date=${date}`,

  journeyRoutes: () => '/journey/routes',

  mapConfig: () => '/map/config',

  // WHY: no `/eventmap/*` route exists to call: booths arrive as ordinary markers on whatever
  // `/map/config` lists as a festival layer's `endpoint`.

  appConfig: () => '/app/config',

  miniApps: () => '/miniapps',
  miniAppDetail: (id: string) => `/miniapps/${id}`,
  miniAppFeed: (id: string) => `/miniapps/${encodeURIComponent(id)}/notifications`,

  games: () => '/games',
  gameDetail: (id: string) => `/games/${encodeURIComponent(id)}`,

  noticesTabs: () => '/notices/tabs',
  noticesBySource: (sourceId: string) => `/notices/source/${sourceId}`,
  noticesMulti: () => '/notices',
  noticeDetail: (sourceId: string, articleNo: number) =>
    `/notices/${sourceId}/${articleNo}`,
} as const;
