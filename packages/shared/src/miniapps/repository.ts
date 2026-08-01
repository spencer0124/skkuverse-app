/**
 * Mini-app data access — server-driven.
 *
 * The registry lives in skkuverse-server (`src/miniapps/`, served at
 * `GET /miniapps` and `GET /miniapps/:id`). Nothing is bundled here: adding or
 * editing a mini-app is a server deploy, not an app release.
 *
 * There is deliberately NO bundled fallback. A baked-in copy would be a second
 * source of truth that silently wins whenever the network is slow, which is
 * exactly the drift this migration removes. What replaces it is a last-known-
 * good MMKV cache: written only from successful responses, always beaten by a
 * fresh fetch, and empty on a first launch that has never reached the server.
 * That first-launch-offline case renders an empty mini-app grid, which is the
 * accepted cost of having one source of truth.
 */
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { readCache, writeCache } from '../store/mmkv-cache';
import {
  parseMiniAppDetail,
  parseMiniAppIndex,
  type MiniAppDetail,
  type MiniAppIndexEntry,
} from './schema';

const INDEX_CACHE_KEY = 'miniapp:index:v1';
const detailCacheKey = (id: string) => `miniapp:detail:v1:${id}`;

// ── Last-known-good cache ──
// Cached blobs are re-parsed through the same tolerant parsers used on live
// responses, so a value written by an older build can never inject a shape the
// current one doesn't expect.

function readCachedIndex(): MiniAppIndexEntry[] | null {
  return readCache(INDEX_CACHE_KEY, (raw) => {
    const parsed = parseMiniAppIndex(raw);
    return parsed.miniApps.length > 0 ? parsed.miniApps : null;
  });
}

function readCachedDetail(id: string): MiniAppDetail | null {
  return readCache(detailCacheKey(id), parseMiniAppDetail);
}

/**
 * Cached index, or an empty array. Synchronous — this is what seeds React Query
 * so the home grid paints without a flash on a warm start.
 */
export function getCachedMiniAppIndex(): MiniAppIndexEntry[] {
  return readCachedIndex() ?? [];
}

/** Cached detail for a slug, or undefined. Synchronous. */
export function getCachedMiniAppDetail(id: string): MiniAppDetail | undefined {
  return readCachedDetail(id) ?? undefined;
}

// ── Repository ──

export interface MiniAppRepository {
  getIndex(): Promise<MiniAppIndexEntry[]>;
  getDetail(id: string): Promise<MiniAppDetail>;
}

export const remoteMiniAppRepository: MiniAppRepository = {
  async getIndex() {
    const result = await safeGet(ApiEndpoints.miniApps(), (envelope) =>
      parseMiniAppIndex(envelope.data),
    );

    if (result.ok && result.data.miniApps.length > 0) {
      writeCache(INDEX_CACHE_KEY, result.data);
      return result.data.miniApps;
    }

    // Network/parse failure, or a server that returned nothing usable. Serve
    // the last-known-good rather than blanking a grid that was fine a moment
    // ago; React Query keeps retrying underneath.
    const cached = readCachedIndex();
    if (cached) return cached;

    if (!result.ok && __DEV__) {
      console.debug('[miniapps] index fetch failed, no cache:', result.failure);
    }
    return [];
  },

  async getDetail(id) {
    const result = await safeGet(ApiEndpoints.miniAppDetail(id), (envelope) =>
      parseMiniAppDetail(envelope.data),
    );

    if (result.ok && result.data) {
      writeCache(detailCacheKey(id), result.data);
      return result.data;
    }

    const cached = readCachedDetail(id);
    if (cached) return cached;

    // Unlike the index, this one throws: the caller is opening a specific
    // mini-app, and there is no degraded shell worth showing without a
    // startUrl. React Query surfaces it as an error state.
    throw new Error(`Unknown or unavailable mini-app id: ${id}`);
  },
};

export const miniAppRepository: MiniAppRepository = remoteMiniAppRepository;
