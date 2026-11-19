type Params = Record<string, string | string[] | undefined>;

// WHY: the `_screen` names stay for dashboard continuity; newer routes use `<feature>_*` without the suffix.
export const SCREEN_NAMES: Readonly<Record<string, string>> = {
  '/home': 'home',
  '/campus': 'campus_screen',
  '/transit': 'transit_screen',
  '/notices': 'notices_tab',
  '/notices/picker': 'notices_picker',
  '/notices/search': 'notices_search',
  '/notices/saved': 'notices_bookmarks',
  '/search': 'search_screen',
  '/bus/realtime': 'bus_realtime_screen',
  '/bus/schedule': 'bus_schedule_screen',
  '/subway': 'subway_arrivals',
  '/meals': 'meals',
  '/map/hssc': 'map_hssc_screen',
  '/map/hssc-credit': 'map_hssc_credit_screen',
  '/this-week': 'this_week_all',
  '/settings': 'settings_root',
  '/settings/account': 'settings_account',
  '/settings/licenses': 'settings_licenses',
  '/settings/licenses/oss': 'settings_licenses_oss',
  '/settings/licenses/attributions': 'settings_licenses_attributions',
  '/settings/licenses/tos': 'settings_licenses_tos',
  '/settings/debug-logs': 'settings_debug_logs',
  '/notifications/settings': 'notifications_settings',
  '/notifications/essential': 'notifications_essential',
  '/notifications/services': 'notifications_services',
  '/notifications/notices': 'notifications_notices',
  '/login': 'login_screen',
  '/onboarding': 'onboarding_root',
  '/profile-setup': 'profile_setup',
  '/mini-app': 'mini_app_screen',
  '/video-gallery': 'video_gallery',
  '/video-player': 'video_player',
  '/sds-states': 'dev_sds_states',
  '/auth-faults': 'dev_auth_faults',
};

const IDENTITY_PARAMS: Readonly<Record<string, string>> = {
  '/mini-app': 'id',
  '/webview': 'url',
  '/video-player': 'videoId',
  '/subway': 'station',
};

export type ScreenOverlay = 'intro';

function param(params: Params, key: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

// QUIRK(firebase): GA4 dashboards and filters expect a screen name of `[a-z0-9_]` only.
function slug(value: string, max = 60): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
}

// QUIRK(react-native): the `URL` polyfill does not implement `host` on every version, so a regex.
export function urlHost(url: string): string {
  const match = /^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i.exec(url.trim());
  return match ? match[1]!.toLowerCase().replace(/^www\./, '') : '';
}

export function resolveScreenName(pathname: string, params: Params): string | null {
  if (pathname === '/webview') {
    // WHY: the host, not the title, since a translated title reports one page under a name per language.
    const host = slug(urlHost(param(params, 'url')));
    return host ? `webview_${host}` : 'webview';
  }
  if (pathname.startsWith('/miniapp-feed/')) return 'miniapp_feed';
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'games' && segments[1]) {
    const game = slug(segments[1]);
    if (!game) return null;
    if (segments.length === 2) return `game_${game}`;
    if (segments.length === 3 && segments[2] === 'leaderboard') return `game_${game}_leaderboard`;
  }
  if (segments[0] === 'routes' && segments.length === 2) return 'campus_route';
  if (segments[0] === 'notices') {
    if (segments.length === 3) return 'notice_detail';
    if (segments.length === 4 && segments[3] === 'body') return 'notice_body';
    if (segments.length === 2 && !['picker', 'search', 'saved'].includes(segments[1] ?? '')) {
      return 'notices_list';
    }
  }
  return SCREEN_NAMES[pathname] ?? null;
}

export function screenKey(pathname: string, params: Params): string {
  const identity = IDENTITY_PARAMS[pathname];
  return identity ? `${pathname}?${identity}=${param(params, identity)}` : pathname;
}

export interface ScreenViewInput {
  ready: boolean;
  overlay: ScreenOverlay | null;
  pathname: string;
  params: Params;
}

export interface ScreenViewDecision {
  key: string | null;
  log: string | null;
}

// WHY: a route with no name still becomes the current key, so coming back from it logs the screen returned to.
export function decideScreenView(lastKey: string | null, input: ScreenViewInput): ScreenViewDecision {
  if (!input.ready) return { key: lastKey, log: null };
  const key = input.overlay ? `#${input.overlay}` : screenKey(input.pathname, input.params);
  if (key === lastKey) return { key, log: null };
  const name = input.overlay ?? resolveScreenName(input.pathname, input.params);
  return { key, log: name };
}
