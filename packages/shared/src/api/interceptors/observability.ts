import type { AxiosResponse } from 'axios';

/**
 * Observability interceptor — logs server-generated request IDs and timing.
 *
 * Only active in __DEV__ mode. Logs X-Request-Id and X-Response-Time
 * headers from the Express server.
 *
 * Flutter source: lib/core/data/interceptors/observability_interceptor.dart
 */
export function observabilityInterceptor(
  response: AxiosResponse,
): AxiosResponse {
  if (__DEV__) {
    const requestId = response.headers['x-request-id'];
    const responseTime = response.headers['x-response-time'];
    const path = response.config.url;

    if (requestId || responseTime) {
      console.debug(`[api] ${requestId ?? ''} ${path} ${responseTime ?? ''}`);
    }
  }
  return response;
}
