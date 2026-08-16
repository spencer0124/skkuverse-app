import Constants from 'expo-constants';

/**
 * API configuration.
 *
 * Reads from Expo's `app.config.ts` → `extra` field, which is injected
 * via EXPO_PUBLIC_* env vars at build time. `apps/mobile/.env` is the single
 * source of truth for the host: `eas.json` sets EXPO_PUBLIC_BASE_URL in no
 * profile, and `.easignore` deliberately ships `.env` into the EAS sandbox
 * so the build reads the same file a local run does.
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
    'EXPO_PUBLIC_BASE_URL is missing. Set it in apps/mobile/.env — ' +
      'app.config.ts reads that env var into `extra.baseUrl`, which is what ' +
      'this module reads back at runtime. There is no fallback host by ' +
      'design: a silent default let builds ship against the wrong API host ' +
      'unnoticed.',
  );
}

export const ApiConfig = {
  baseUrl,
} as const;
