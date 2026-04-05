const ALLOWED_PATHS = ['/campus', '/transit', '/map/hssc', '/search'];

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    // path can be "/search", "skkuverse://search", "skkuverse:///search" etc.
    let pathname = path;

    // Strip scheme if present
    const schemeIndex = pathname.indexOf('://');
    if (schemeIndex !== -1) {
      pathname = pathname.substring(schemeIndex + 3);
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
    if (pathname === '/') return path;

    // 화이트리스트 체크
    if (ALLOWED_PATHS.some((allowed) => pathname === allowed)) return path;

    // 그 외 전부 홈으로
    return '/(tabs)/campus';
  } catch {
    return '/(tabs)/campus';
  }
}
