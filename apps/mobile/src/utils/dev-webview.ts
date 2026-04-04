/**
 * Dev-only: rewrite webview URLs to localhost Vite server.
 * In production, returns the original URL or falls back to deployed webview.
 */

const DEV_WEBVIEW_BASE = 'http://localhost:5173';
const PROD_WEBVIEW_BASE = 'https://webview.skkuuniverse.com';

export function devRewriteInfoUrl(
  serverUrl: string | undefined,
  fallbackHash = '#/bus/hssc/info',
): string {
  // TODO: 개발 모드에서 localhost Vite 서버로 리다이렉트 복원 예정
  return serverUrl ?? `${PROD_WEBVIEW_BASE}/${fallbackHash}`;
}
