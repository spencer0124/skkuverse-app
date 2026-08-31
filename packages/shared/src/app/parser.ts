/**
 * App config response parser — JSON → AppConfig.
 *
 * Parses the GET /app/config endpoint response.
 */

import type { ApiEnvelope } from '../api/types';

export interface PlatformConfig {
  minVersion: string;
  updateUrl: string | null;
}

export interface WebviewConfig {
  /**
   * Origins allowed to reach the native bridge from the /webview shell.
   *
   * Server-owned (skkuverse-server `src/infra/origins.ts` → `BRIDGE_ORIGINS`).
   * Entries are bare origins — scheme + host + optional port, no path, no
   * trailing slash — because the client compares them against
   * `new URL(pageUrl).origin`.
   */
  bridgeOrigins: string[];
}

export interface WebConfig {
  /**
   * Marketing/launcher origin for mini-app share links and add-to-home
   * shortcuts. null when the server didn't send one — callers must degrade
   * (share the current page URL, hide add-to-home) rather than fall back to a
   * hardcoded host, which would be the second source of truth all over again.
   */
  origin: string | null;
}

export interface AppConfig {
  ios: PlatformConfig;
  android: PlatformConfig;
  webview: WebviewConfig;
  web: WebConfig;
}

function parsePlatform(raw: unknown): PlatformConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    minVersion: typeof obj.minVersion === 'string' ? obj.minVersion : '0.0.0',
    updateUrl: typeof obj.updateUrl === 'string' ? obj.updateUrl : null,
  };
}

/**
 * Parse the webview section.
 *
 * FAILS CLOSED — a missing, malformed, or non-array `bridgeOrigins` yields `[]`,
 * which grants the bridge to nobody. This deliberately inverts the fallback
 * direction used elsewhere in this package (`useMapConfig` serves
 * DEFAULT_MAP_CONFIG when the API dies, because a map with no campuses is
 * broken while a stale one is merely old). Here the failure mode is not a worse
 * UI — it is handing `Linking.openURL` to a page nobody vetted — so degrading
 * has to mean granting less, never defaulting to a baked-in list.
 *
 * Note that `useCampusSections` is no longer the example to reach for: its
 * defaults were emptied when the campus sheet became a promo feed, so it now
 * degrades to nothing for a reason of its own. See `sdui/defaults.ts`.
 *
 * Entries are normalized through `new URL().origin` so a server that ever ships
 * a path or a trailing slash still produces something the per-message origin
 * comparison can match, rather than silently never matching.
 */
function parseWebview(raw: unknown): WebviewConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const list = obj.bridgeOrigins;
  if (!Array.isArray(list)) return { bridgeOrigins: [] };

  const origins: string[] = [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    try {
      const { origin, protocol } = new URL(entry);
      // https only: an http origin is trivially spoofable on a hostile network,
      // which would defeat the point of having an allowlist.
      if (protocol !== 'https:') continue;
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      // Unparseable entry — drop it rather than storing something that can
      // never match anyway.
    }
  }
  return { bridgeOrigins: origins };
}

function parseWeb(raw: unknown): WebConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const origin = obj.origin;
  if (typeof origin !== 'string') return { origin: null };
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' ? { origin: url.origin } : { origin: null };
  } catch {
    return { origin: null };
  }
}

export function parseAppConfig(envelope: ApiEnvelope<unknown>): AppConfig {
  const data = (envelope.data ?? {}) as Record<string, unknown>;
  return {
    ios: parsePlatform(data.ios),
    android: parsePlatform(data.android),
    webview: parseWebview(data.webview),
    web: parseWeb(data.web),
  };
}
