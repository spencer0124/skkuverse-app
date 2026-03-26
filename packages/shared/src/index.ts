// ── Design tokens ──
export { SdsColors } from './tokens/colors';
export { SdsTypo, type SdsTextStyle } from './tokens/typography';
export { SdsSpacing } from './tokens/spacing';
export { SdsRadius } from './tokens/radius';
export { SdsShadows } from './tokens/shadows';
export { SdsDuration, SdsCurves } from './tokens/duration';

// ── API types ──
export type {
  AppFailure,
  NetworkFailure,
  ServerFailure,
  ParseFailure,
  CancelledFailure,
  Result,
  ApiEnvelope,
  ConditionalResult,
} from './api/types';
export { Failure, ResultHelper } from './api/types';

// ── API endpoints ──
export { ApiEndpoints } from './api/endpoints';

// ── API client ──
export { createApiClient, getApiClient, resetApiClient } from './api/client';
export { ApiConfig } from './api/config';

// ── Safe request wrappers ──
export {
  safeGet,
  safePost,
  safeGetRaw,
  safeGetConditional,
  firePost,
} from './api/safe-request';

// ── Auth ──
export { setAuthTokenProvider } from './api/interceptors/auth';

// ── Stores ──
export { authStore, useAuthStore } from './store/auth';
export type { AuthState, AuthStore } from './store/auth';
export { useSettingsStore } from './store/settings';
export type { SettingsStore, Campus, AppLanguage } from './store/settings';
export { useMapLayerStore } from './store/map';
export type { MapLayerStore } from './store/map';

// ── SDUI types ──
export type {
  SduiSection,
  SduiButtonGrid,
  SduiSectionTitle,
  SduiNotice,
  SduiBanner,
  SduiSpacer,
  SduiUnknown,
  SduiButtonItem,
  CampusSectionsResponse,
} from './types/sdui';
export { type ActionType, parseActionType } from './types/sdui';

// ── Bus types ──
export type {
  BusListItem,
  BusListCard,
  BusListAction,
  BusGroup,
  RealtimeBusGroup,
  ScheduleBusGroup,
  BusGroupVisibility,
  BusGroupCard,
  RealtimeScreenConfig,
  ScheduleScreenConfig,
  RealtimeStation,
  TransferLine,
  BusService,
  RouteBadge,
  HeroCard,
  RealtimeData,
  RealtimeMeta,
  RealtimeBus,
  StationEta,
  SmartSchedule,
  DaySchedule,
  ScheduleEntry,
  ScheduleNotice,
  CampusEta,
} from './types/bus';
export { hexToColor, isBusGroupVisible } from './types/bus';

// ── Map types ──
export type {
  NaverConfig,
  CampusDef,
  MapLayerStyle,
  MapLayerDef,
  MapConfig,
  RawMarkerData,
  PolylineCoord,
} from './types/map';

// ── Building types ──
export type {
  LocalizedText,
  BuildingImage,
  Accessibility,
  Building,
  FloorSpace,
  FloorInfo,
  BuildingConnection,
  BuildingDetail,
  SearchSpaceItem,
  SpaceGroup,
  BuildingSearchResult,
  BuildingNavPayload,
} from './types/building';
export { getLocalizedText } from './types/building';

// ── SDUI ──
export { parseCampusResponse, DEFAULT_CAMPUS_SECTIONS } from './sdui';

// ── Bus parsers ──
export {
  parseTransitList,
  parseBusGroup,
  parseRealtimeData,
  parseSmartSchedule,
  parseCampusEta,
} from './bus';

// ── Map parsers + defaults ──
export {
  parseMapConfig,
  parseMarkerData,
  parsePolylineData,
  DEFAULT_MAP_CONFIG,
} from './map';

// ── Building parsers ──
export {
  parseBuildingList,
  parseBuildingDetail,
  parseBuildingSearchResult,
} from './building';

// ── Hooks ──
export {
  useCampusSections,
  CAMPUS_SECTIONS_KEY,
  useTransitList,
  TRANSIT_LIST_KEY,
  useBusConfig,
  BUS_CONFIG_KEY,
  useRealtimeData,
  REALTIME_DATA_KEY,
  useSmartSchedule,
  SMART_SCHEDULE_KEY,
  useCampusEta,
  CAMPUS_ETA_KEY,
  useMainNotice,
  MAIN_NOTICE_KEY,
  type NoticePlacement,
  useMapConfig,
  MAP_CONFIG_KEY,
  useBuildings,
  BUILDINGS_KEY,
  useBuildingDetail,
  BUILDING_DETAIL_KEY,
  useLayerMarkers,
  useLayerPolyline,
  useSearchBuildings,
  BUILDING_SEARCH_KEY,
} from './hooks';
