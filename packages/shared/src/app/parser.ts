/**
 * App config response parser — JSON → AppConfig.
 *
 * Parses the GET /app/config endpoint response.
 */

import type { ApiEnvelope } from '../api/types';

export interface PlatformConfig {
  minVersion: string;
  updateUrl: string | null;
}

export interface AppConfig {
  ios: PlatformConfig;
  android: PlatformConfig;
}

function parsePlatform(raw: unknown): PlatformConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    minVersion: typeof obj.minVersion === 'string' ? obj.minVersion : '0.0.0',
    updateUrl: typeof obj.updateUrl === 'string' ? obj.updateUrl : null,
  };
}

export function parseAppConfig(envelope: ApiEnvelope<unknown>): AppConfig {
  const data = (envelope.data ?? {}) as Record<string, unknown>;
  return {
    ios: parsePlatform(data.ios),
    android: parsePlatform(data.android),
  };
}
