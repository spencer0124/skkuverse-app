/**
 * Mini-app registry — client-side wire types + tolerant parsers.
 *
 * The registry is SERVER-OWNED (skkuverse-server `src/miniapps/`, exposed at
 * `GET /miniapps` and `GET /miniapps/:id`). This module no longer defines the
 * data, only how to read it.
 *
 * Parsing is deliberately TOLERANT — the mirror image of the server's
 * `assertValidRegistry`, which throws at boot. The asymmetry is the point: the
 * server validates config it can fix, so it fails loud; the client renders a
 * payload it can only display, so a bad field costs one tile rather than the
 * whole grid. Unknown fields are ignored outright, which is what lets the server
 * ship additive schema changes to already-released apps.
 *
 * `id` is a stable kebab-case slug and never the Korean display name: it is the
 * join key, the deep-link path (`/m/<id>`), the cache key, and the analytics id,
 * so it must survive renames and translations.
 */

/** Bump only on BREAKING schema changes (removed/renamed/retyped field). */
export const MINIAPP_REGISTRY_VERSION = 1;

/** Logo source. Server-hosted only — bundled `require()` logos are gone. */
export interface MiniAppLogo {
  kind: 'remote';
  uri: string;
}

/** Index entry — only what the home grid + deep-link resolution need. */
export interface MiniAppIndexEntry {
  id: string;
  /** Full service name (header title, share sheet). */
  name: string;
  /** Short label for the home grid tile; falls back to `name`. */
  shortName?: string;
  order: number;
  /** null when the server sent no usable logo — the tile still renders. */
  logo: MiniAppLogo | null;
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

/** Per-service detail — heavier content, needed when opening the mini-app. */
export interface MiniAppDetail {
  version: number;
  id: string;
  /** Mini-app start URL = home destination of the mini-app shell. */
  startUrl: string;
  /** Show the verified badge in the page-info sheet. */
  verified: boolean;
  description?: string;
  relatedLinks: MiniAppLink[];
  noticeBanner?: MiniAppNoticeBanner;
}

const HTTP_RE = /^https?:\/\//;
const SLUG_RE = /^[a-z0-9-]+$/;

function asRecord(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null
    ? (raw as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** https/http URL or undefined. Rejects `javascript:`, `data:`, and friends. */
function asHttpUrl(v: unknown): string | undefined {
  return typeof v === 'string' && HTTP_RE.test(v) ? v : undefined;
}

function parseLogo(raw: unknown): MiniAppLogo | null {
  const obj = asRecord(raw);
  if (!obj || obj.kind !== 'remote') return null;
  const uri = asHttpUrl(obj.uri);
  return uri ? { kind: 'remote', uri } : null;
}

/**
 * Parse one index entry. Returns null only when the entry lacks what makes it
 * usable at all — a tile with no slug id can't be opened, and one with no name
 * can't be labelled. Everything else degrades in place.
 */
function parseIndexEntry(
  raw: unknown,
  fallbackOrder: number,
): MiniAppIndexEntry | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = asString(obj.id);
  const name = asString(obj.name);
  if (!id || !SLUG_RE.test(id) || !name) return null;
  const shortName = asString(obj.shortName);
  return {
    id,
    name,
    ...(shortName ? { shortName } : {}),
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    logo: parseLogo(obj.logo),
  };
}

/**
 * Parse `GET /miniapps`. Malformed entries are dropped individually; a
 * malformed envelope yields an empty registry rather than throwing.
 */
export function parseMiniAppIndex(raw: unknown): MiniAppIndex {
  const obj = asRecord(raw);
  const list = obj?.miniApps;
  if (!Array.isArray(list)) {
    return { version: MINIAPP_REGISTRY_VERSION, miniApps: [] };
  }
  const miniApps = list
    .map((entry, i) => parseIndexEntry(entry, i))
    .filter((e): e is MiniAppIndexEntry => e !== null)
    .sort((a, b) => a.order - b.order);
  return {
    version:
      typeof obj?.version === 'number' ? obj.version : MINIAPP_REGISTRY_VERSION,
    miniApps,
  };
}

function parseLinks(raw: unknown): MiniAppLink[] {
  if (!Array.isArray(raw)) return [];
  const links: MiniAppLink[] = [];
  for (const entry of raw) {
    const obj = asRecord(entry);
    const url = asHttpUrl(obj?.url);
    if (!url) continue;
    const label = asString(obj?.label);
    links.push({ ...(label ? { label } : {}), url });
  }
  return links;
}

function parseNoticeBanner(raw: unknown): MiniAppNoticeBanner | undefined {
  const obj = asRecord(raw);
  const title = asString(obj?.title);
  const subtitle = asString(obj?.subtitle);
  return title && subtitle ? { title, subtitle } : undefined;
}

/**
 * Parse `GET /miniapps/:id`. Returns null when the payload has no usable
 * `startUrl` — the shell exists to load that URL, so there is nothing to show
 * without it. A non-http scheme counts as absent: `startUrl` is handed straight
 * to a WebView, so `javascript:` there would execute inside the shell.
 */
export function parseMiniAppDetail(raw: unknown): MiniAppDetail | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = asString(obj.id);
  const startUrl = asHttpUrl(obj.startUrl);
  if (!id || !SLUG_RE.test(id) || !startUrl) return null;
  const description = asString(obj.description);
  const noticeBanner = parseNoticeBanner(obj.noticeBanner);
  return {
    version:
      typeof obj.version === 'number' ? obj.version : MINIAPP_REGISTRY_VERSION,
    id,
    startUrl,
    verified: obj.verified === true,
    ...(description ? { description } : {}),
    relatedLinks: parseLinks(obj.relatedLinks),
    ...(noticeBanner ? { noticeBanner } : {}),
  };
}
