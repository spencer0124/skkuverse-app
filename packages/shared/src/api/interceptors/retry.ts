import type { AxiosError, AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay, isNetworkError } from 'axios-retry';

/**
 * Retry interceptor — the app's ONLY retry layer for API requests.
 *
 * React Query's own retry is off (`apps/mobile/src/lib/query-client.ts`), because
 * two layers multiply: 3 axios attempts × 2 query attempts made a failing query
 * send 6 requests, all on the same fixed delays, so every device that failed
 * together retried together — exactly when the server was least able to answer.
 *
 * One retry, and only for failures a second attempt can plausibly fix:
 * - no response at all (connection reset, DNS), any method;
 * - a timeout on an idempotent method, with a fresh timeout for the retry;
 * - 502/503/504 on an idempotent method — a replica restarting or an edge hiccup.
 *
 * Never retried: 429 (the rate limiter asked us to slow down), 500 (the same
 * request fails the same way) and every other 4xx. 401 is the auth
 * interceptor's job. A POST is never retried on a status, because it may have
 * been applied.
 *
 * The delay honours `Retry-After` when the server sends one, and carries up to
 * 20% jitter so a burst of failures does not come back as a burst of retries.
 */

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);
const RETRY_BASE_DELAY_MS = 500;

function isTimeout(error: AxiosError): boolean {
  return !error.response && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT');
}

export function shouldRetryRequest(error: AxiosError): boolean {
  if (isNetworkError(error)) return true;

  const method = error.config?.method?.toLowerCase();
  if (method === undefined || !IDEMPOTENT_METHODS.has(method)) return false;

  if (isTimeout(error)) return true;
  const status = error.response?.status;
  return status !== undefined && RETRYABLE_STATUSES.has(status);
}

export function retryDelayMs(retryCount: number, error: AxiosError): number {
  return exponentialDelay(retryCount, error, RETRY_BASE_DELAY_MS);
}

export function attachRetryInterceptor(client: AxiosInstance): void {
  axiosRetry(client, {
    retries: 1,
    retryCondition: shouldRetryRequest,
    retryDelay: retryDelayMs,
    shouldResetTimeout: true,
  });
}
