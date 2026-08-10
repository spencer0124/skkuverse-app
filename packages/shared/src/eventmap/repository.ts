/**
 * Event map fetching and the last-known-good cache.
 *
 * This is the only module in `eventmap/` that touches I/O, and therefore the
 * only one that may reference `__DEV__` — the pure modules stay vitest-safe
 * because packages/shared has no shim for it.
 *
 * The cache is what makes the festival case work: campus wifi at an event is
 * the actual operating condition, and a snapshot on disk keeps deriving live
 * status against the clock long after the network has gone.
 */

import { ApiEndpoints } from '../api/endpoints';
import { safeGetTimed } from '../api/safe-request';
import { readCache, writeCache } from '../store/mmkv-cache';
import type { EventMapManifest, EventMapSnapshot } from '../types/eventmap';
import { parseEventMapManifest, parseEventMapSnapshot } from './parser';
import type { DroppedCounts } from './parser';

/**
 * One slot, not one per version. A version-keyed cache would accumulate an entry
 * per publish across a festival and never evict them; there is only ever one
 * event worth restoring.
 */
const SNAPSHOT_CACHE_KEY = 'eventmap:snapshot:v1';

/** The version was TTL-reaped server-side. Distinct from any other failure. */
export class SnapshotGoneError extends Error {
  constructor(url: string) {
    super(`Event map snapshot gone: ${url}`);
    this.name = 'SnapshotGoneError';
  }
}

export interface EventMapBundle {
  snapshot: EventMapSnapshot;
  dropped: DroppedCounts;
}

/**
 * Never throws. An unreadable manifest is indistinguishable, for the app's
 * purposes, from one saying there is no active event — and in both cases the
 * right behaviour is to leave the base map alone.
 *
 * Returns the timing headers alongside, because this is the ONLY response the
 * clock offset may be measured from (see clock.ts).
 */
export async function fetchEventMapManifest(): Promise<{
  manifest: EventMapManifest;
  serverDate: number | null;
  age: number | null;
  fetchedAt: number;
}> {
  const result = await safeGetTimed(ApiEndpoints.eventMapManifest(), (envelope) =>
    parseEventMapManifest(envelope.data),
  );
  if (result.ok) {
    return {
      manifest: result.data.data,
      serverDate: result.data.serverDate,
      age: result.data.age,
      fetchedAt: result.data.fetchedAt,
    };
  }
  if (__DEV__) {
    console.debug('[eventmap] manifest failed, treating as inactive:', result.failure);
  }
  return {
    manifest: parseEventMapManifest(null),
    serverDate: null,
    age: null,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch one immutable snapshot.
 *
 * Deliberately does NOT read the `Date` header: this response is served
 * `immutable, max-age=1y`, so a cached copy replays the origin's original
 * timestamp and would poison the clock offset by however long it sat on disk.
 *
 * Throws `SnapshotGoneError` on 404 so the caller can go back to the manifest;
 * every other failure throws too, and the caller falls back to the cache.
 */
export async function fetchEventMapSnapshot(url: string): Promise<EventMapBundle> {
  const result = await safeGetTimed(url, (envelope) => parseEventMapSnapshot(envelope.data));
  if (!result.ok) {
    const failure = result.failure;
    if (failure.type === 'server' && failure.statusCode === 404) {
      throw new SnapshotGoneError(url);
    }
    // CancelledFailure carries no message, so do not assume one.
    const detail = failure.type === 'cancelled' ? 'cancelled' : failure.message;
    throw new Error(`Event map snapshot failed: ${detail}`);
  }

  const { snapshot, dropped } = result.data.data;
  if (!snapshot) {
    // Unusable or newer-than-this-build. Not an error the user should see, but
    // there is nothing to render and nothing worth caching.
    throw new Error('Event map snapshot unusable');
  }
  if (__DEV__ && dropped.reasons.length > 0) {
    console.debug('[eventmap] dropped while parsing snapshot:', dropped);
  }

  const bundle: EventMapBundle = { snapshot, dropped };
  writeCache(SNAPSHOT_CACHE_KEY, snapshot);
  return bundle;
}

/**
 * The last snapshot that parsed, or null.
 *
 * `validate` re-runs the real parser rather than trusting the blob: the cache
 * outlives app updates, so a snapshot written by an older build can be
 * structurally wrong for this one.
 */
export function readCachedEventMapBundle(): EventMapBundle | null {
  return readCache<EventMapBundle>(SNAPSHOT_CACHE_KEY, (raw) => {
    const { snapshot, dropped } = parseEventMapSnapshot(raw);
    return snapshot ? { snapshot, dropped } : null;
  });
}
