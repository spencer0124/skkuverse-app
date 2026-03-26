import Constants from 'expo-constants';

/**
 * Environment-aware API configuration.
 *
 * Reads from Expo's `app.config.ts` → `extra` field, which is injected
 * via EXPO_PUBLIC_* env vars at build time.
 *
 * Defaults to production API if not configured (same behavior as Flutter).
 *
 * Flutter source: lib/core/data/api_config.dart
 */
const extra = Constants.expoConfig?.extra as
  | { baseUrl?: string; env?: string }
  | undefined;

export const ApiConfig = {
  baseUrl: extra?.baseUrl ?? 'https://api.skkuuniverse.com',
  env: extra?.env ?? 'prod',
  get isProduction() {
    return this.env === 'prod';
  },
} as const;
