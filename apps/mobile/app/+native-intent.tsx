const ALLOWED_PATHS = ['/campus', '/transit', '/map/hssc', '/search'];

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'skkuverse://');
    const pathname = url.pathname;

    // 루트("/")는 허용 — 기존 로직대로 홈으로 감
    if (pathname === '/' || pathname === '') return path;

    // 화이트리스트 체크
    if (ALLOWED_PATHS.some((allowed) => pathname === allowed)) return path;

    // 그 외 전부 홈으로
    return '/(tabs)/campus';
  } catch {
    return '/(tabs)/campus';
  }
}
