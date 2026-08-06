/**
 * Last-known-good cache for GET /app/config.
 *
 * Exists because the webview bridge allowlist has to be readable SYNCHRONOUSLY,
 * from a non-React context, at the moment a WebView posts a message — there is
 * no opportunity to await a fetch inside `onMessage`. The boot-time
 * `checkForceUpdate()` call already fetches this config and previously threw
 * everything but `minVersion` away; now it seeds this cache instead, so the
 * allowlist is in memory before any webview can open.
 *
 * Layering, most to least authoritative:
 *   1. in-memory value written by this session's successful fetch
 *   2. MMKV copy of the last successful fetch from a previous session
 *   3. nothing → `null` → callers fail closed
 *
 * The MMKV copy is never authoritative: it is only ever written from a server
 * response, and a fresh fetch always overwrites it. There is no bundled
 * fallback, by design — a baked-in allowlist would be exactly the hardcoded
 * source of truth this migration removes.
 */
import { readCache, writeCache } from '../store/mmkv-cache';
import type { AppConfig } from './parser';

const CACHE_KEY = 'app-config:v1';

let memo: AppConfig | null = null;

/**
 * Re-validate a cached blob against the CURRENT AppConfig shape.
 *
 * A value written by an older build can be structurally stale (this is exactly
 * how `webview` arrived — older builds cached configs without it), so anything
 * missing is rebuilt at its fail-closed default rather than trusted.
 */
function validate(raw: unknown): AppConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.ios !== 'object' || typeof obj.android !== 'object') {
    return null;
  }
  const webview = obj.webview as Record<string, unknown> | undefined;
  const origins = webview?.bridgeOrigins;
  const web = obj.web as Record<string, unknown> | undefined;
  return {
    ios: obj.ios as AppConfig['ios'],
    android: obj.android as AppConfig['android'],
    webview: {
      bridgeOrigins: Array.isArray(origins)
        ? origins.filter((o): o is string => typeof o === 'string')
        : [],
    },
    web: {
      origin: typeof web?.origin === 'string' ? web.origin : null,
    },
  };
}

/** Store a freshly fetched config as the new last-known-good. */
export function setCachedAppConfig(config: AppConfig): void {
  memo = config;
  writeCache(CACHE_KEY, config);
}

/**
 * Read the cached config synchronously. Returns null when nothing has ever been
 * fetched on this device — callers must treat that as "grant nothing", not as
 * "no restrictions".
 */
export function getCachedAppConfig(): AppConfig | null {
  if (memo) return memo;
  memo = readCache(CACHE_KEY, validate);
  return memo;
}

/**
 * Origins currently allowed to reach the native bridge. Empty when the config
 * has never been fetched, when the fetch failed, or when the server sent none.
 */
export function getBridgeOrigins(): string[] {
  return getCachedAppConfig()?.webview.bridgeOrigins ?? [];
}

/**
 * Marketing/launcher origin for mini-app share links and add-to-home shortcuts,
 * or null when unknown. Callers degrade (share the page URL, hide add-to-home)
 * rather than substituting a hardcoded host.
 */
export function getWebOrigin(): string | null {
  return getCachedAppConfig()?.web.origin ?? null;
}

/** Test seam — drops the in-memory copy so the next read hits MMKV. */
export function resetAppConfigMemo(): void {
  memo = null;
}
