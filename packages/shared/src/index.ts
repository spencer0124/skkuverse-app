// WHY: the TDS color names (`SdsColors`, `resolveSdsColors`) stay unexported: only importers of
// colors.ts itself read them, and the app reads roles (sds-7).
export {
  SdsPalette,
  type AdaptiveColor,
  type ColorMode,
} from './tokens/colors';
export {
  SdsSemanticColors,
  semanticColorSteps,
  resolveSemanticColors,
  asSdsColor,
  type SdsColor,
  type SemanticColors,
  type FgColorName,
  type BgColorName,
  type StrokeColorName,
} from './tokens/semanticColors';
export {
  SdsTypeScale,
  WANTED_SANS,
  type FontWeightValue,
  type SdsTextStyle,
  type SdsTextStyleName,
  type SdsTypeScaleKey,
  type SdsTypeStep,
} from './tokens/typography';
// WHY: typography.ts stays import-free for the web copies, so SdsTypo is resolved for this platform
// in textStyles.ts.
export { SdsTypo, wantedSans } from './tokens/textStyles';
export { resolveWantedSansFace, type WantedSansFace } from './tokens/fontFace';
export { SdsSpacing } from './tokens/spacing';
export { SdsRadius } from './tokens/radius';
export { SdsShadows, type SdsShadowLevel } from './tokens/shadows';
export { SdsDuration, SdsCurves } from './tokens/duration';

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
export { nextSnapshot, type ConditionalSnapshot } from './api/conditional';

export { ApiEndpoints } from './api/endpoints';

export { createApiClient, getApiClient, resetApiClient } from './api/client';
export { ApiConfig } from './api/config';
export { API_TIMEOUT_MS } from './api/timeouts';

export {
  safeGet,
  safePost,
  safeGetRaw,
  safeGetConditional,
  firePost,
} from './api/safe-request';

export { setAuthTokenProvider } from './api/interceptors/auth';

export { t, tpl, useT, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './i18n';
export type { TranslationKey } from './i18n';

export { authStore, useAuthStore } from './store/auth';
export type { AuthState, AuthStore, AuthUser } from './store/auth';
export { useSettingsStore, CAMPUSES } from './store/settings';
export { asMember, toFiniteNumber } from './utils/allowlist';
export type { SettingsStore, Campus, AppLanguage, TabRoute, SeenKey } from './store/settings';
export { useEngagementStore } from './store/engagement';
export { useLaunchStore, type LaunchStore } from './store/launch.store';
export type { EngagementStore, EngagementState, ReviewPromptOutcome, ReviewPromptHistoryEntry } from './store/engagement';

export type {
  UserDocument,
  DeviceDocument,
  PreferencesDocument,
} from './store/notifications.types';
export { useNotificationStore, notificationStore, DEFAULT_PREFERENCES } from './store/notifications';
export type {
  NotificationStore,
  PushPermissionStatus,
} from './store/notifications';
export { useBookmarkStore, bookmarkStore } from './store/bookmarks';
export type { BookmarkStore } from './store/bookmarks';

export type { BookmarkEntry } from './store/bookmarks.types';
export { bookmarkKey, parseBookmarkKey } from './store/bookmarks.types';

export {
  type ActionType,
  NAVIGABLE_ACTION_TYPES,
  type NavigableActionType,
  parseActionType,
} from './utils/sdui-action.rules';
export { parseMapPlaceRef, type MapPlaceRef, type PlaceKind } from './utils/map-place-ref.rules';
export { parseI18nText } from './utils/i18n-text.rules';

export { hexToColor } from './utils/hex-color.rules';
export { legibleOn, type LegibleOnOptions } from './utils/contrast';

export type { TransitGroupState } from './store/settings';

export type { SubwayChoice, SubwayDirectionKey } from './utils/subway-line.types';

export type { LatLng } from './utils/lat-lng.types';
export type { I18nText } from './utils/i18n-text.rules';


export { type LocalizedText, getLocalizedText } from './utils/localized-text.rules';
export { floorBadge } from './utils/floor-badge.rules';
export { handsOffToOs, instagramDestination, isInstagramUrl } from './utils/instagram-url.rules';
export { gameIdForUrl, toBrowserUrl } from './utils/web-url.rules';
export { withAlpha } from './utils/with-alpha.rules';
export { withRetry } from './utils/with-retry';

export type {
  PlatformConfig,
  WebviewConfig,
  WebConfig,
  MiniAppsConfig,
  GamesConfig,
  AppConfig,
} from './schema/app-config.schema';
export { parseAppConfig } from './schema/app-config.schema';
export {
  cacheAppConfigResponse,
  getCachedAppConfig,
  getBridgeOrigins,
  getWebOrigin,
  getMiniAppOrigins,
  getGameOrigins,
  resetAppConfigMemo,
} from './store/app-config';

export { isVersionLessThan } from './utils/version';
export { resolveInitialTabRouteName } from './utils/resolveInitialTabRoute';
export { normalizeIncomingPath, parseIncomingLink } from './utils/normalizeIncomingPath';
export type { IncomingLink } from './utils/normalizeIncomingPath';



export { kstMinutesOfDay, toMinutesOfDay, msIntoKstDay, MS_PER_DAY, MS_PER_MINUTE } from './time/kst.rules';
export { toEpochMs } from './time/epoch.rules';

export { markerLabelColumns, pickI18nText, wrapMarkerLabel } from './utils/marker-text.rules';
export { formatKstDate, formatKstDateTime, formatKstTime, formatTimeWindow } from './time/kst-format.rules';

export { dataOrFallback } from './store/fallback';
export { createPendingSlot, type PendingSlot, type PendingSlotLog, type PendingSlotOptions } from './store/pending-slot.store';

export {
  parseMiniAppTarget,
  resolveMiniAppUrl,
  miniAppTargetForUrl,
  type MiniAppTarget,
} from './utils/miniapp-target.rules';

export * from './schema/tolerant';
export * from './schema/banner-carousel.schema';
export * from './schema/logo.schema';
export { readCache, writeCache, clearCache } from './store/mmkv-cache';
export { cachedQueryOptions, type CachedQueryOptionsInputs } from './store/cached-query-options';
export { queryClient } from './store/query-client';
export * from './time/clock.rules';
export { KST_OFFSET_MS, kstDate } from './time/kst.rules';
