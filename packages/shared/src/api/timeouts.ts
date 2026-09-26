/**
 * Per-request timeouts for the API client, in milliseconds.
 *
 * Why these are short: some Cloudflare edges (Hong Kong in particular) reach
 * the Korean origin over a lossy path, and a request can stall for 5–30 s
 * before anything comes back. A stalled request is cheaper to cut and retry
 * than to wait out — the retry usually takes a healthy path. The retry
 * interceptor (`interceptors/retry.ts`) retries a timed-out GET once, after
 * about 1.0–1.2 s, and restarts the timeout for that retry.
 *
 * Worst case for a GET that stalls twice (timeout + delay + timeout):
 * - `read`:     6 + 1.2 + 6  ≈ 13 s (was 10 + 1.2 + 10 ≈ 21 s)
 * - `realtime`: 4 + 1.2 + 4  ≈ 9 s
 *
 * Which one applies:
 * - `realtime` — bus position polling (`useRealtimeData`). **Invariant: it must
 *   stay below half of the smallest server-sent `refreshInterval` (currently
 *   10 s, `/bus/config`)**, so both attempts of one poll finish before the next
 *   poll is due. A poll that outlives its interval blocks the next one, because
 *   React Query joins an interval refetch to the request still in flight.
 * - `read` — every other GET, applied by the `safeGet*` wrappers when the
 *   caller does not pass its own `timeout`.
 * - `boot` — the one-shot `/app/config` check at launch, which fails open.
 * - `write` — the axios instance default, so anything that bypasses the GET
 *   wrappers (POSTs, direct client calls) keeps the old 10 s. A POST is never
 *   retried on a timeout, so it gets the longest budget.
 *
 * Largest response today is `/building/list` at about 25 KB gzipped, well
 * inside `read` even on a slow link. A route that genuinely needs longer
 * should pass its own `timeout` rather than raise `read` for everyone.
 */
export const API_TIMEOUT_MS = {
  realtime: 4_000,
  read: 6_000,
  boot: 5_000,
  write: 10_000,
} as const;
