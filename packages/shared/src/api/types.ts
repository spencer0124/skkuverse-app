/**
 * Typed failure hierarchy for API errors.
 *
 * Mirrors Flutter's sealed AppFailure class with a discriminated union on `type`.
 * Controllers narrow with `if (result.ok)` — TypeScript auto-narrows the union.
 *
 * Flutter source: lib/core/data/result.dart
 */

// ── Failure types ──

export interface NetworkFailure {
  type: 'network';
  message: string;
}

export interface ServerFailure {
  type: 'server';
  statusCode: number;
  message: string;
  errorCode?: string;
}

export interface ParseFailure {
  type: 'parse';
  message: string;
}

export interface CancelledFailure {
  type: 'cancelled';
}

export type AppFailure =
  | NetworkFailure
  | ServerFailure
  | ParseFailure
  | CancelledFailure;

/** Factory namespace for creating typed failures */
export const Failure = {
  network: (message: string): NetworkFailure => ({
    type: 'network',
    message,
  }),

  server: (
    statusCode: number,
    message: string,
    errorCode?: string,
  ): ServerFailure => ({
    type: 'server',
    statusCode,
    message,
    ...(errorCode !== undefined && { errorCode }),
  }),

  parse: (message: string): ParseFailure => ({
    type: 'parse',
    message,
  }),

  cancelled: (): CancelledFailure => ({
    type: 'cancelled',
  }),
} as const;

// ── Result<T> ──

interface Ok<T> {
  ok: true;
  data: T;
}

interface Err {
  ok: false;
  failure: AppFailure;
}

export type Result<T> = Ok<T> | Err;

/** Companion namespace for creating Result values */
export const ResultHelper = {
  ok: <T>(data: T): Result<T> => ({ ok: true, data }),
  error: <T>(failure: AppFailure): Result<T> => ({ ok: false, failure }),
} as const;

// ── API Envelope ──

/** v2 API response envelope: `{ meta, data }` */
export interface ApiEnvelope<T> {
  meta: {
    code: number;
    message?: string;
  };
  data: T;
}

// ── Conditional GET result ──

/** Result of ETag-based conditional GET (RFC 7232) */
export interface ConditionalResult<T> {
  data: T | null;
  etag: string | null;
  /** true when server returned 304 — cached data is still fresh */
  notModified: boolean;
}
