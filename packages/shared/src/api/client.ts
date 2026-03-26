import axios, { type AxiosInstance } from 'axios';
import { ApiConfig } from './config';
import {
  platformInterceptor,
  observabilityInterceptor,
  attachRetryInterceptor,
} from './interceptors';

/**
 * Creates a fully-configured axios instance with the interceptor chain.
 *
 * Interceptor order:
 * - Request:  platform (adds headers)
 * - Response: observability (logs request IDs in __DEV__)
 * - Retry:    axios-retry (handles 408/429/503)
 *
 * Auth interceptor is added in Step 3.2. Axios request interceptors are LIFO,
 * so auth added later will run first — ensuring the token is attached before
 * platform headers.
 *
 * Flutter source: lib/core/data/dio_client.dart
 */
export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: ApiConfig.baseUrl,
    timeout: 10_000,
  });

  // Request interceptor: platform headers
  client.interceptors.request.use(platformInterceptor);

  // Response interceptor: observability logging
  client.interceptors.response.use(observabilityInterceptor);

  // Retry interceptor: transient failure recovery
  attachRetryInterceptor(client);

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
