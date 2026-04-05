const ALLOWED_PATHS = ['/campus', '/transit', '/map/hssc', '/search'];

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
    if (pathname === '/') return path;

    // 화이트리스트 체크
    if (ALLOWED_PATHS.some((allowed) => pathname === allowed)) return path;

    // 그 외 전부 홈으로
    return '/(tabs)/campus';
  } catch {
    return '/(tabs)/campus';
  }
}
