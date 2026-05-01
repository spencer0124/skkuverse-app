import { useSettingsStore, resolveInitialTabRouteName } from '@skkuverse/shared';

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
  // Cold-start path delivery. Bare `/` is resolved to the lastTab-restored
  // route here so app/index.tsx never mounts (its <Redirect> would otherwise
  // leave a titleless phantom entry in the root Stack history, visible on
  // iOS long-press of the back button). All other cold-start paths bypass
  // the redirect logic below — deep links like /notices/cse/5847 must land
  // on their static route handler unmodified, and unstable_settings.
  // initialRouteName='(tabs)' anchors the stack underneath them.
  // MMKV is sync (Zustand+MMKV — see (tabs)/_layout.tsx:30-37 for the
  // mirror pattern at the tabs nav level), safe to read here.
  if (initial) {
    if (path === '/') {
      const lastTab = useSettingsStore.getState().lastTab;
      return `/(tabs)/${resolveInitialTabRouteName(lastTab)}`;
    }
    return path;
  }

  try {
    let pathname = path;

    // Strip scheme if present
    const schemeIndex = pathname.indexOf('://');
    if (schemeIndex !== -1) {
      const afterScheme = pathname.substring(schemeIndex + 3);
      const slashIndex = afterScheme.indexOf('/');

      if (slashIndex === -1) {
        // "skkuverse://search" or "https://skkuverse.com" — no slash after scheme
        const segment = afterScheme.split('?')[0];
        // If it looks like a domain (has a dot), treat as host-only → root
        pathname = segment.includes('.') ? '/' : '/' + segment;
      } else {
        const host = afterScheme.substring(0, slashIndex);
        const rest = afterScheme.substring(slashIndex);
        // If host looks like a domain (has a dot), strip it
        // "skkuverse.com/map/hssc" → "/map/hssc"
        // "map/hssc" → keep as-is (shouldn't happen but safe)
        pathname = host.includes('.') ? rest : '/' + afterScheme;
      }
    }

    // Ensure leading slash
    if (!pathname.startsWith('/')) {
      pathname = '/' + pathname;
    }

    // Remove query string
    const qIndex = pathname.indexOf('?');
    if (qIndex !== -1) {
      pathname = pathname.substring(0, qIndex);
    }

    // Strip /p/ prefix (universal link path namespace)
    if (pathname.startsWith('/p/')) {
      pathname = pathname.substring(2); // "/p/search" → "/search"
    }

    // 루트("/")는 home 탭으로
    if (pathname === '/') return '/(tabs)/home';

    // Dynamic notice path — pass through to expo-router so it lands on
    // app/notices/[sourceId]/[articleNo].tsx. Done BEFORE the static
    // whitelist check because /notices/* is intentionally not in
    // ALLOWED_PATHS (the dynamic shape can't be enumerated statically).
    if (NOTICE_PATH_RE.test(pathname)) {
      return pathname;
    }

    // 화이트리스트 체크
    if (!ALLOWED_PATHS.some((allowed) => pathname === allowed)) {
      return '/(tabs)/home';
    }

    // 탭 경로는 명시적 그룹 경로로 반환
    if (TAB_PATHS[pathname]) return TAB_PATHS[pathname];

    // 비탭 경로 (search, map/hssc) — unstable_settings가 (tabs)를 스택 아래에 삽입
    return pathname;
  } catch {
    return '/(tabs)/home';
  }
}
