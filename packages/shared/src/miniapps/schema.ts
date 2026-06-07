/**
 * Mini-app registry — 2-tier SSOT (index + per-service detail), joined by `id`.
 *
 * `id` is a stable kebab-case slug (NEVER the Korean display name): it's the
 * join key, the deep-link path (`/m/<id>`), the cache key, and the analytics id,
 * so it must survive renames/translations.
 *
 * TS types here are the source of truth (no zod — repo convention). The bundled
 * JSON is validated by `assertValidRegistry` at module load + a unit test. When
 * the registry goes server-driven, add `safeParse`-style tolerance for the
 * untrusted remote payload.
 */

/** Bump only on BREAKING schema changes (removed/renamed/retyped field). */
export const MINIAPP_REGISTRY_VERSION = 1;

/** Logo source — bundled (RN require key) now, remote URL when server-driven. */
export type MiniAppLogo =
  | { kind: 'bundled'; key: string }
  | { kind: 'remote'; uri: string };

/** Index entry — only what the home grid + deep-link need. Deeplink = `/m/<id>`. */
export interface MiniAppIndexEntry {
  id: string;
  /** Full service name (header title, share). */
  name: string;
  /** Short label for the home grid tile; falls back to `name`. */
  shortName?: string;
  order: number;
  logo: MiniAppLogo;
}

export interface MiniAppIndex {
  version: number;
  miniApps: MiniAppIndexEntry[];
}

export interface MiniAppLink {
  label?: string;
  url: string;
}

export interface MiniAppNoticeBanner {
  title: string;
  subtitle: string;
}

/** Per-service detail — heavy content, fetched/needed when opening the mini-app. */
export interface MiniAppDetail {
  version: number;
  id: string;
  /** Mini-app start URL = home destination of the in-app browser. */
  startUrl: string;
  /** Show the verified badge in the page-info sheet. */
  verified: boolean;
  description?: string;
  relatedLinks: MiniAppLink[];
  noticeBanner?: MiniAppNoticeBanner;
}

const HTTP_RE = /^https?:\/\//;
const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Referential-integrity + shape check. Throws loud on malformed bundled config
 * (our own data → a typo is a bug, not a runtime contingency). Called at module
 * load and asserted in the registry unit test.
 */
export function assertValidRegistry(
  index: MiniAppIndex,
  details: Record<string, MiniAppDetail>,
): void {
  const ids = index.miniApps.map((m) => m.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('miniapp registry: duplicate ids in index');
  }
  for (const entry of index.miniApps) {
    if (!SLUG_RE.test(entry.id)) {
      throw new Error(`miniapp registry: invalid id slug "${entry.id}"`);
    }
    const detail = details[entry.id];
    if (!detail) {
      throw new Error(`miniapp registry: index id "${entry.id}" has no detail`);
    }
    if (detail.id !== entry.id) {
      throw new Error(`miniapp registry: detail.id "${detail.id}" != index id "${entry.id}"`);
    }
    if (!HTTP_RE.test(detail.startUrl)) {
      throw new Error(`miniapp registry: bad startUrl for "${entry.id}"`);
    }
    for (const link of detail.relatedLinks) {
      if (!HTTP_RE.test(link.url)) {
        throw new Error(`miniapp registry: bad relatedLinks url in "${entry.id}"`);
      }
    }
  }
  for (const id of Object.keys(details)) {
    if (!ids.includes(id)) {
      throw new Error(`miniapp registry: detail "${id}" not present in index`);
    }
  }
}
