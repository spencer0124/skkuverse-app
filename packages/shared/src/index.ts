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

// ── i18n ──
export { t, tpl, useT, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './i18n';
export type { TranslationKey } from './i18n';

// ── Stores ──
export { authStore, useAuthStore } from './store/auth';
export type { AuthState, AuthStore, AuthUser } from './store/auth';
export { useSettingsStore } from './store/settings';
export type { SettingsStore, Campus, AppLanguage, TabRoute } from './store/settings';
export { useMapLayerStore } from './store/map';
export type { MapLayerStore } from './store/map';
export { useEngagementStore } from './store/engagement';
export type { EngagementStore, EngagementState, ReviewPromptOutcome, ReviewPromptHistoryEntry } from './store/engagement';

// ── Notifications ──
export type {
  UserDocument,
  DeviceDocument,
  PreferencesDocument,
} from './types/notifications';
export {
  TopicPrefix,
  buildTopic,
  parseTopic,
} from './constants/topics';
export type { TopicPrefixValue } from './constants/topics';
export { useNotificationStore, notificationStore } from './store/notifications';
export type {
  NotificationStore,
  PushPermissionStatus,
} from './store/notifications';
export { useBookmarkStore, bookmarkStore } from './store/bookmarks';
export type { BookmarkStore } from './store/bookmarks';

// ── Bookmark types ──
export type { BookmarkEntry, BookmarkSummaryType } from './types/bookmarks';
export { bookmarkKey, parseBookmarkKey } from './types/bookmarks';

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
  CampusCounts,
  SearchCounts,
  BuildingNavPayload,
} from './types/building';
export { getLocalizedText, floorBadge } from './types/building';

// ── App config ──
export type {
  PlatformConfig,
  WebviewConfig,
  WebConfig,
  AppConfig,
} from './app/parser';
export { parseAppConfig } from './app/parser';
export {
  setCachedAppConfig,
  getCachedAppConfig,
  getBridgeOrigins,
  getWebOrigin,
  resetAppConfigMemo,
} from './app/config-cache';

// ── Version utils ──
export { isVersionLessThan } from './utils/version';
export { resolveInitialTabRouteName } from './utils/resolveInitialTabRoute';
export { normalizeIncomingPath, parseIncomingLink } from './utils/normalizeIncomingPath';
export type { IncomingLink } from './utils/normalizeIncomingPath';

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

// ── Event map ──
export type {
  EventMapAction,
  EventMapCardSlot,
  EventMapCardTemplate,
  EventMapChip,
  EventMapChipGroup,
  EventMapItem,
  EventMapLayer,
  EventMapManifest,
  EventMapSnapshot,
  EventMapSort,
  IconSpec,
  ItemStatus,
  LayerRender,
  Predicate,
  SortKey,
} from './types/eventmap';
export {
  EVENTMAP_SCHEMA_VERSION,
  ITEM_STATUSES,
  LAYER_RENDERS,
  PREDICATE_KINDS,
  SORT_KEYS,
} from './types/eventmap';
export {
  buildStacks,
  computeOffset,
  deriveItemStatus,
  deriveItems,
  evaluatePredicate,
  isValidPredicate,
  nextBoundaryAfter,
  parseEventMapManifest,
  parseEventMapSnapshot,
  parseInstant,
  readUsableOffset,
  selectVisibleStacks,
  serverNow,
} from './eventmap';
export type {
  BuiltStacks,
  ClockOffset,
  DerivedItem,
  DroppedCounts,
  EventMapStack,
  ParsedSnapshot,
  PredicateSubject,
} from './eventmap';

// ── Building parsers ──
export {
  parseBuildingList,
  parseBuildingDetail,
  parseBuildingSearchResult,
} from './building';

// ── Notice parsers + types ──
export {
  parseTabsConfig,
  parseNoticePage,
  parseNoticeDetail,
  hasBundledExcludeReasonCopy,
  resolvePickerSelection,
  computeOnboardingPickerSeed,
  highlightMatches,
  classifyBookmarkToggleError,
  filterPickerSources,
  isUnsupportedSource,
  recommendCollegeMates,
  findCollegeUmbrella,
} from './notices';
export type {
  ExcludeReasonKey,
  TabSource,
  PickerTabConfig,
  FixedTabConfig,
  NoticeTab,
  NoticeTabsConfig,
  NoticeSource,
  NoticeSummaryType,
  NoticeStartAt,
  NoticeEndAt,
  NoticeListItem,
  NoticeListItemSummary,
  NoticePage,
  NoticeDetail,
  NoticeDetailSummary,
  NoticeSummaryDetails,
  NoticePeriod,
  NoticeLocation,
  NoticeAttachment,
  NoticeEditInfo,
  HighlightSegment,
  FilterPickerSourcesOptions,
  CollegeMates,
} from './notices';

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
  useNoticeTabs,
  NOTICE_TABS_KEY,
  useNoticeList,
  NOTICE_LIST_KEY,
  type UseNoticeListArgs,
  useMultiSourceNoticeList,
  NOTICE_MULTI_KEY,
  type UseMultiSourceNoticeListArgs,
  useNoticeDetail,
  NOTICE_DETAIL_KEY,
} from './hooks';

// ── Mini-app registry (2-tier SSOT: index + per-service detail, joined by id) ──
export * from './miniapps';
