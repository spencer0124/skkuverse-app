import type { AxiosInstance } from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';

/**
 * Retry interceptor — automatic retry for transient failures.
 *
 * Retries on: connection errors, timeouts, 408, 429, 503.
 * Does NOT retry 401 — that's handled by the auth interceptor (Step 3.2).
 *
 * Flutter source: lib/core/data/interceptors/retry_interceptor.dart
 */

const RETRYABLE_STATUSES = new Set([408, 429, 503]);

export function attachRetryInterceptor(client: AxiosInstance): void {
  axiosRetry(client, {
    retries: 2,
    retryDelay: (retryCount) => {
      // Delays: 1s, 3s (matching Flutter's retryDelays)
      return retryCount === 1 ? 1000 : 3000;
    },
    retryCondition: (error) => {
      // Network errors and timeouts
      if (isNetworkOrIdempotentRequestError(error)) {
        return true;
      }
      // Specific retryable status codes
      const status = error.response?.status;
      return status !== undefined && RETRYABLE_STATUSES.has(status);
    },
  });
}
