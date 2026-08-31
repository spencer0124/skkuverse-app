export { useCampusSections, CAMPUS_SECTIONS_KEY } from './useCampusSections';
export { useTransitList, TRANSIT_LIST_KEY } from './useTransitList';
export { useBusConfig, BUS_CONFIG_KEY } from './useBusConfig';
export { useRealtimeData, REALTIME_DATA_KEY } from './useRealtimeData';
export { useSmartSchedule, SMART_SCHEDULE_KEY } from './useSmartSchedule';
export { useCampusEta, CAMPUS_ETA_KEY } from './useCampusEta';
export { useMainNotice, MAIN_NOTICE_KEY, type NoticePlacement } from './useMainNotice';

// ── Map hooks ──
export { useMapConfig, MAP_CONFIG_KEY } from './useMapConfig';
export { useBuildings, BUILDINGS_KEY } from './useBuildings';
export { useBuildingDetail, BUILDING_DETAIL_KEY } from './useBuildingDetail';
export {
  useLayerOverlays,
  MAP_LAYER_OVERLAYS_KEY,
} from './useMapLayers';
export { useWindowClock } from './useWindowClock';
export { useSearchBuildings, BUILDING_SEARCH_KEY } from './useSearchBuildings';

// ── Notice hooks ──
export { useNoticeTabs, NOTICE_TABS_KEY } from './useNoticeTabs';
export { useNoticeList, NOTICE_LIST_KEY } from './useNoticeList';
export type { UseNoticeListArgs } from './useNoticeList';
export { useMultiSourceNoticeList, NOTICE_MULTI_KEY } from './useMultiSourceNoticeList';
export type { UseMultiSourceNoticeListArgs } from './useMultiSourceNoticeList';
export { useNoticeDetail, NOTICE_DETAIL_KEY } from './useNoticeDetail';
