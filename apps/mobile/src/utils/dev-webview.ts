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
  if (!__DEV__) {
    return serverUrl ?? `${PROD_WEBVIEW_BASE}/${fallbackHash}`;
  }

  if (serverUrl) {
    const hashIdx = serverUrl.indexOf('#');
    if (hashIdx >= 0) return `${DEV_WEBVIEW_BASE}/${serverUrl.slice(hashIdx)}`;
    // URL without hash — just swap the base
    try {
      const u = new URL(serverUrl);
      return `${DEV_WEBVIEW_BASE}${u.pathname}${u.hash}`;
    } catch {
      return `${DEV_WEBVIEW_BASE}/${fallbackHash}`;
    }
  }

  // No server URL at all — show fallback so ⓘ button appears in dev
  return `${DEV_WEBVIEW_BASE}/${fallbackHash}`;
}
