import {
  normalizeIncomingPath,
  resolveInitialTabRouteName,
  useSettingsStore,
} from '@skkuverse/shared';
import { pendingExternalNoticeLink } from '@/lib/pending-external-notice-link';
import { pendingMiniAppLink } from '@/lib/pending-mini-app-link';

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
// Capture groups feed pendingExternalNoticeLink so the root layout can push
// the detail screen on top of the notices tab (vs. on top of whatever tab
// happened to be active when the link arrived).
const NOTICE_PATH_RE = /^\/notices\/([a-z0-9-]+)\/(\d+)$/;

// Mini-app entry: /m/<slug> (universal `…/p/m/<slug>` or scheme `skkuverse://m/<slug>`).
// Same pending-holder pattern as notices — route to home, then the root layout's
// PendingMiniAppLinkConsumer opens the mini-app on top.
//
// SHAPE ONLY — registry membership is NOT checked here. The registry is
// server-owned now, with no bundled copy to read synchronously; keeping a seed
// just to answer this one question would reintroduce the second source of truth
// the migration removed.
//
// Not because this function can't be async — expo-router types it
// `=> Promise<string> | string` and awaits it. Because of what awaiting COSTS
// here: it runs outside the React tree before mount, so (1) it can't share the
// QueryClient cache the shell reads from, making it a duplicate request, and
// (2) the app's entire first navigation would block on a network round-trip —
// an offline cold start would paint nothing until the axios timeout. So the
// membership check moved to PendingMiniAppLinkConsumer, which runs post-mount
// and pays neither cost.
//
// Security is unchanged: an unknown slug still resolves to /(tabs)/home and
// cannot push an arbitrary internal route. The consumer drops it on lookup
// failure, so the worst case is a deep link that lands on home.
const MINIAPP_PATH_RE = /^\/m\/([a-z0-9-]+)$/;

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
    // enumerated in ALLOWED_PATHS. We route the navigation to /(tabs)/notices
    // first and stash the (sourceId, articleNo) intent for the root layout's
    // PendingNoticeLinkConsumer to push as a follow-up detail screen — that
    // way back arrow lands on the notices tab instead of whatever tab was
    // active when the universal link arrived.
    const noticeMatch = pathname.match(NOTICE_PATH_RE);
    if (noticeMatch) {
      pendingExternalNoticeLink.set({
        sourceId: noticeMatch[1],
        articleNo: noticeMatch[2],
        source: 'universal_link',
      });
      return '/(tabs)/notices';
    }

    // Mini-app path → stash slug + route to home; PendingMiniAppLinkConsumer
    // resolves it against the server registry and opens the shell (or drops it).
    const miniAppMatch = pathname.match(MINIAPP_PATH_RE);
    if (miniAppMatch) {
      pendingMiniAppLink.set({ id: miniAppMatch[1] });
      return '/(tabs)/home';
    }

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
