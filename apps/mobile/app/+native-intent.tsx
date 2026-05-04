import { normalizeIncomingPath, resolveInitialTabRouteName, useSettingsStore } from '@skkuverse/shared';

const ALLOWED_PATHS = ['/home', '/campus', '/transit', '/map/hssc', '/search'];

const TAB_PATHS: Record<string, string> = {
  '/home': '/(tabs)/home',
  '/campus': '/(tabs)/campus',
  '/transit': '/(tabs)/transit',
};

// Dynamic universal-link path: /notices/<sourceId>/<articleNo>.
// sourceId matches the kebab-case slug regex enforced by Firestore Rules
// + crawler config; articleNo is a positive integer extracted from the
// source page URL by the crawler. Anchored with ^...$ so e.g.
// `/notices/cse/5847/extra` doesn't match (would route to homepage instead).
const NOTICE_PATH_RE = /^\/notices\/[a-z0-9-]+\/\d+$/;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // Cold start (`initial: true`) receives the launch URL — possibly the full
  // form "skkuverse:///p/notices/x/y" — while warm start receives the parsed
  // pathname "/p/notices/x/y" via Expo's Linking event subscription. Both go
  // through normalizeIncomingPath (uses `new URL()` per Expo native-intent
  // doc) so downstream validation is uniform. Only the bare-/ branch differs:
  // cold restores lastTab (avoids titleless phantom entry in iOS long-press
  // back history when app/index.tsx mounts a <Redirect>); warm sends to home.
  // MMKV is sync (Zustand+MMKV), safe to read here even though +native-intent
  // runs outside the React tree.
  try {
    const pathname = normalizeIncomingPath(path);

    if (pathname === '/') {
      if (initial) {
        const lastTab = useSettingsStore.getState().lastTab;
        return `/(tabs)/${resolveInitialTabRouteName(lastTab)}`;
      }
      return '/(tabs)/home';
    }

    // Dynamic notice path → app/notices/[sourceId]/[articleNo].tsx.
    // Done before the static whitelist because the dynamic shape can't be
    // enumerated in ALLOWED_PATHS.
    if (NOTICE_PATH_RE.test(pathname)) return pathname;

    // Whitelist — anything else falls back to home (uniform across cold/warm
    // so untrusted deep links can't push to arbitrary internal routes like
    // /login or /onboarding).
    if (!ALLOWED_PATHS.some((allowed) => pathname === allowed)) {
      return '/(tabs)/home';
    }

    if (TAB_PATHS[pathname]) return TAB_PATHS[pathname];
    return pathname;
  } catch {
    return '/(tabs)/home';
  }
}
