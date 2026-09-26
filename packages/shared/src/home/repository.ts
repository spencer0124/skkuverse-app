/**
 * Home layout data access — `GET /ui/home`, server-owned.
 *
 * Same last-known-good MMKV cache as the mini-app registry (see
 * `miniapps/repository.ts`): written only from successful responses, beaten by
 * every fresh fetch, re-parsed on read so a blob from an older build cannot
 * inject a shape this one does not expect. It exists so a warm start paints the
 * sectioned home at once instead of flashing the fallback layout first.
 *
 * Unlike the registry there IS a fallback when both the network and the cache
 * come up empty — the home screen's own default layout (the built-in banner
 * over one flat grid). So a failure with no cache throws, which leaves the
 * query without data and lets React Query retry, rather than caching "nothing".
 */
import { safeGet } from '../api/safe-request';
import { ApiEndpoints } from '../api/endpoints';
import { readCache, writeCache } from '../store/mmkv-cache';
import { parseHomeLayout, type HomeLayout } from './schema';

const LAYOUT_CACHE_KEY = 'home:layout:v1';

/** Cached layout, or undefined. Synchronous — it seeds React Query. */
export function getCachedHomeLayout(): HomeLayout | undefined {
  return readCache(LAYOUT_CACHE_KEY, parseHomeLayout) ?? undefined;
}

export async function fetchHomeLayout(): Promise<HomeLayout> {
  const result = await safeGet(ApiEndpoints.homeLayout(), (envelope) =>
    parseHomeLayout(envelope.data),
  );

  if (result.ok && result.data) {
    writeCache(LAYOUT_CACHE_KEY, result.data);
    return result.data;
  }

  const cached = getCachedHomeLayout();
  if (cached) return cached;

  if (__DEV__) {
    console.debug('[home] layout fetch failed, no cache:', result.ok ? 'unparseable' : result.failure);
  }
  throw new Error('Home layout unavailable');
}
