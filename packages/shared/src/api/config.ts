import Constants from 'expo-constants';

/**
 * API configuration.
 *
 * Reads `extra.baseUrl` from Expo's `app.config.ts`, where `resolveBaseUrl()`
 * writes it from `PROD_API_URL` in `apps/mobile/config/constants.js` — a
 * committed constant, not an environment variable. On a shipping profile
 * (`EAS_BUILD_PROFILE` or `RELEASE_CHANNEL` naming beta or production)
 * `EXPO_PUBLIC_BASE_URL` is not consulted at all; off one it is an optional
 * local override that defaults to the same constant. `apps/mobile/.env` holds
 * no host value and is excluded from the EAS build archive by `.easignore`.
 */
const extra = Constants.expoConfig?.extra as { baseUrl?: string } | undefined;

// Trimmed, because a whitespace-only value is a missing value wearing a
// disguise — `''` and `'  '` both mean "the env var never got substituted".
const baseUrl = extra?.baseUrl?.trim();

// NO FALLBACK, BY DESIGN. This used to be `?? 'https://api.skkuuniverse.com'`,
// which turned a missing env var into a silent misconfiguration instead of an
// error. That is not hypothetical: the OTA updates published on the 1.0.0 and
// 3.5.0 runtime channels carry no `extra.baseUrl` at all (EXPO_PUBLIC_BASE_URL
// was unset when they were published), so every one of those installs fell
// through to the hardcoded legacy host and has been talking to it ever since.
// Nobody noticed, because a wrong-but-reachable host looks exactly like a
// working app until the day the host is retired.
//
// Throwing at module init is the loudest failure available here: this module is
// re-exported from `packages/shared/src/index.ts` and imported by
// `api/client.ts`, so it evaluates while the bundle is still coming up. The app
// cannot reach a screen, which means a broken build cannot be published without
// the publisher seeing it — the whole point of removing the fallback.
if (!baseUrl) {
  throw new Error(
    '`extra.baseUrl` is missing from the Expo config. app.config.ts always ' +
      'writes it — resolveBaseUrl() returns PROD_API_URL from ' +
      'apps/mobile/config/constants.js — so reaching this line means the ' +
      'bundle is running against a manifest produced before that was true: ' +
      'an OTA update published on the production/1.0.0 or production/3.5.0 ' +
      'runtime channel, or a binary built from a broken config. There is no ' +
      'fallback host by design: a silent default let builds talk to the ' +
      'wrong API host unnoticed for months.',
  );
}

export const ApiConfig = {
  baseUrl,
} as const;
