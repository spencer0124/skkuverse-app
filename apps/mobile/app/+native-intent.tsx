const ALLOWED_PATHS = ['/campus', '/transit', '/map/hssc', '/search'];

const TAB_PATHS: Record<string, string> = {
  '/campus': '/(tabs)/campus',
  '/transit': '/(tabs)/transit',
};

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
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

    // 루트("/")는 허용 — 기존 로직대로 홈으로 감
    if (pathname === '/') return '/(tabs)/campus';

    // 화이트리스트 체크
    if (!ALLOWED_PATHS.some((allowed) => pathname === allowed)) {
      return '/(tabs)/campus';
    }

    // 탭 경로는 명시적 그룹 경로로 반환
    if (TAB_PATHS[pathname]) return TAB_PATHS[pathname];

    // 비탭 경로 (search, map/hssc) — unstable_settings가 (tabs)를 스택 아래에 삽입
    return pathname;
  } catch {
    return '/(tabs)/campus';
  }
}
