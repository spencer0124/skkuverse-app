import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosError,
} from 'axios';
import type {
  AppFailure,
  Result,
  ApiEnvelope,
  ConditionalResult,
} from './types';
import { Failure, ResultHelper } from './types';
import { getApiClient } from './client';

/**
 * Safe request wrappers — every API call returns Result<T>, never throws.
 *
 * Mirrors Flutter's ApiClient methods: safeGet, safePost, safeGetRaw,
 * safeGetConditional, firePost.
 *
 * Flutter source: lib/core/data/api_client.dart
 */

// ── Error mapping ──

function parseServerError(error: AxiosError): AppFailure {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;

  // Try v2 error envelope: { error: { code, message } }
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as Record<string, unknown>).error === 'object'
  ) {
    const err = (body as Record<string, Record<string, unknown>>).error;
    return Failure.server(
      status,
      (err.message as string) ?? 'Server error',
      err.code as string | undefined,
    );
  }

  return Failure.server(status, `Server error ${status}`);
}

function mapAxiosError(error: unknown): AppFailure {
  if (axios.isCancel(error)) {
    return Failure.cancelled();
  }

  if (axios.isAxiosError(error)) {
    // No response → network/timeout error
    if (!error.response) {
      return Failure.network(`Network error: ${error.message}`);
    }
    // Bad response → parse server error envelope
    return parseServerError(error);
  }

  // Non-Axios error (e.g. parser threw)
  return Failure.parse(`Parse error: ${String(error)}`);
}

function isValidEnvelope(raw: unknown): raw is ApiEnvelope<unknown> {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'meta' in raw &&
    'data' in raw
  );
}

// ── Public wrappers ──

/**
 * GET with v2 envelope validation.
 * Parser receives the full envelope `{ meta, data }`.
 */
export async function safeGet<T>(
  path: string,
  parser: (envelope: ApiEnvelope<unknown>) => T,
  options?: AxiosRequestConfig & { client?: AxiosInstance },
): Promise<Result<T>> {
  const { client, ...axiosConfig } = options ?? {};
  try {
    const response = await (client ?? getApiClient()).get(path, axiosConfig);
    const raw = response.data;
    if (!isValidEnvelope(raw)) {
      return ResultHelper.error(Failure.parse('Invalid v2 envelope'));
    }
    return ResultHelper.ok(parser(raw as ApiEnvelope<unknown>));
  } catch (error) {
    return ResultHelper.error(mapAxiosError(error));
  }
}

/**
 * POST with v2 envelope validation.
 * Parser receives the full envelope `{ meta, data }`.
 */
export async function safePost<T>(
  path: string,
  parser: (envelope: ApiEnvelope<unknown>) => T,
  options?: AxiosRequestConfig & { client?: AxiosInstance },
): Promise<Result<T>> {
  const { client, ...axiosConfig } = options ?? {};
  try {
    const response = await (client ?? getApiClient()).post(path, axiosConfig.data, axiosConfig);
    const raw = response.data;
    if (!isValidEnvelope(raw)) {
      return ResultHelper.error(Failure.parse('Invalid v2 envelope'));
    }
    return ResultHelper.ok(parser(raw as ApiEnvelope<unknown>));
  } catch (error) {
    return ResultHelper.error(mapAxiosError(error));
  }
}

/**
 * Raw GET for v1 endpoints without the v2 envelope.
 */
export async function safeGetRaw(
  path: string,
  options?: AxiosRequestConfig & { client?: AxiosInstance },
): Promise<Result<Record<string, unknown>>> {
  const { client, ...axiosConfig } = options ?? {};
  try {
    const response = await (client ?? getApiClient()).get(path, axiosConfig);
    const raw = response.data;
    if (typeof raw !== 'object' || raw === null) {
      return ResultHelper.error(Failure.parse('Expected JSON object'));
    }
    return ResultHelper.ok(raw as Record<string, unknown>);
  } catch (error) {
    return ResultHelper.error(mapAxiosError(error));
  }
}

/**
 * Conditional GET with ETag support (RFC 7232).
 */
export async function safeGetConditional<T>(
  path: string,
  parser: (envelope: ApiEnvelope<unknown>) => T,
  options?: AxiosRequestConfig & {
    client?: AxiosInstance;
    ifNoneMatch?: string;
  },
): Promise<Result<ConditionalResult<T>>> {
  const { client, ifNoneMatch, ...axiosConfig } = options ?? {};
  try {
    const response = await (client ?? getApiClient()).get(path, {
      ...axiosConfig,
      headers: {
        ...axiosConfig.headers,
        ...(ifNoneMatch && { 'If-None-Match': ifNoneMatch }),
      },
      validateStatus: (s) => s === 200 || s === 304,
    });

    if (response.status === 304) {
      return ResultHelper.ok({
        data: null,
        etag: ifNoneMatch ?? null,
        notModified: true,
      });
    }

    const raw = response.data;
    if (!isValidEnvelope(raw)) {
      return ResultHelper.error(Failure.parse('Invalid v2 envelope'));
    }

    return ResultHelper.ok({
      data: parser(raw as ApiEnvelope<unknown>),
      etag: (response.headers['etag'] as string) ?? null,
      notModified: false,
    });
  } catch (error) {
    return ResultHelper.error(mapAxiosError(error));
  }
}

/**
 * Fire-and-forget POST for analytics/tracking.
 * Failures are logged in __DEV__ only — silent to users.
 */
export async function firePost(
  path: string,
  options?: AxiosRequestConfig & { client?: AxiosInstance },
): Promise<void> {
  const { client, ...axiosConfig } = options ?? {};
  try {
    await (client ?? getApiClient()).post(path, axiosConfig.data, axiosConfig);
  } catch (error) {
    if (__DEV__) {
      console.debug(`[api] firePost ${path} failed:`, error);
    }
  }
}
