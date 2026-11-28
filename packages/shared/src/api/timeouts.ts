/**
 * EVIDENCE: some Cloudflare edges (Hong Kong) reach the Korean origin over a lossy path and stall
 * 5–30 s; cutting a GET and retrying once, with a fresh timeout, usually takes a healthy path.
 */
export const API_TIMEOUT_MS = {
  // WHY: below half the smallest server `refreshInterval` (10 s, `/bus/config`): React Query joins an
  // interval refetch to the request in flight, so a poll outliving its interval blocks the next.
  realtime: 4_000,
  // WHY: a route that needs longer passes its own `timeout`; the largest response, `/building/list`
  // at about 25 KB gzipped, fits even on a slow link.
  read: 6_000,
  boot: 5_000,
  // WHY: the instance default, for whatever bypasses the GET wrappers; a POST is never retried on a
  // timeout, so it gets the longest budget.
  write: 10_000,
} as const;
