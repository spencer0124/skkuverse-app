import axios, { type AxiosInstance } from 'axios';
import { ApiConfig } from './config';
import {
  platformInterceptor,
  observabilityInterceptor,
  attachRetryInterceptor,
  attachAuthInterceptor,
} from './interceptors';
import { API_TIMEOUT_MS } from './timeouts';

/**
 * Creates a fully-configured axios instance with the interceptor chain.
 *
 * Interceptor execution order (request path):
 *   auth (token) → platform (headers) → [network] → retry → observability
 *
 * Axios request interceptors are LIFO — auth is added last so it runs first,
 * ensuring the token is attached before platform headers.
 *
 * Flutter source: lib/core/data/dio_client.dart
 */
export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: ApiConfig.baseUrl,
    // GETs get a shorter `read` timeout from the safeGet* wrappers; this
    // default covers everything else. See ./timeouts.ts.
    timeout: API_TIMEOUT_MS.write,
  });

  // Request interceptor: platform headers
  client.interceptors.request.use(platformInterceptor);

  // Response interceptor: observability logging
  client.interceptors.response.use(observabilityInterceptor);

  // Retry interceptor: transient failure recovery
  attachRetryInterceptor(client);

  // Auth interceptor: token attachment + 401 refresh
  // Axios request interceptors are LIFO — added last, runs first on requests.
  // This ensures the token is attached before platform headers.
  attachAuthInterceptor(client);

  return client;
}

// ── Singleton ──

let instance: AxiosInstance | null = null;

/** Lazy singleton accessor */
export function getApiClient(): AxiosInstance {
  if (!instance) {
    instance = createApiClient();
  }
  return instance;
}

/** Reset singleton — for tests */
export function resetApiClient(): void {
  instance = null;
}
