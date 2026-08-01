import { createMMKV } from 'react-native-mmkv';

/**
 * MMKV instance for last-known-good caches of server-owned data.
 *
 * Separate from `skkubus-settings` (user preferences) on purpose: everything in
 * here is a DISPOSABLE COPY of something the server owns. Clearing it must
 * never lose user state, and nothing in here is ever authoritative — a stale
 * entry loses to a fresh fetch every time.
 *
 * The point of caching at all is that two consumers need server data
 * synchronously, before any request can land:
 *   - the webview bridge allowlist, needed the instant a webview opens
 *   - the mini-app registry, needed to render the home grid without a flash
 *
 * react-native-mmkv v4 (Nitro): `createMMKV()` is the factory, `remove()`
 * replaces the old `delete()`.
 */
const cacheMmkv = createMMKV({ id: 'skkuverse-cache' });

/**
 * Read a cached JSON value. Returns null on a miss, on malformed JSON, or when
 * the stored shape fails `validate`.
 *
 * `validate` is required rather than optional: the cache outlives app updates,
 * so a value written by an older build can be structurally wrong for the
 * current one. Trusting it blindly turns a schema change into a crash on the
 * first launch after update.
 */
export function readCache<T>(
  key: string,
  validate: (raw: unknown) => T | null,
): T | null {
  const raw = cacheMmkv.getString(key);
  if (raw === undefined) return null;
  try {
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Write a value as the new last-known-good. Only ever called with server data. */
export function writeCache(key: string, value: unknown): void {
  try {
    cacheMmkv.set(key, JSON.stringify(value));
  } catch {
    // A cache write failing is not worth surfacing — the live value is already
    // in hand, and the next successful fetch retries this.
  }
}

/** Drop a cached entry (used by tests and by explicit cache-clear paths). */
export function clearCache(key: string): void {
  cacheMmkv.remove(key);
}
