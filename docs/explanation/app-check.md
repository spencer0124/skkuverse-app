---
title: App Check
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# App Check

> The order App Check runs in before an Auth call, how a debug token reaches the iOS simulator, and
> the trade-off between Play Integrity throttling (-8) and `primeAppCheck`.

## Start-up order

- **Until JS configures a provider, there is none.** On iOS a token request before `setupAppCheck`
  configures one fails with `provider-not-ready`. On Android nothing is installed. Since
  `initializeAppCheck` returns before the native configure finishes, the first probe is what waits.
- **Every Auth call is preceded by a probe.** `probeAppCheck` asks for the cached-or-fetched token,
  never a forced one, and answers within `PROBE_TIMEOUT_MS`, or `bounded` while the exchange still
  runs. An App Check failure can come back from Auth as a generic error, so the caller reads the probe.
- **Only a quota stops the call** (`throttled`, and the SDK's `backoff` after one), since the call
  would spend the attestation the quota just refused. After any other failed probe the call goes
  ahead, and the probe's kind sorts a failure (`apps/mobile/src/features/auth/sign-in-errors.rules.ts`).
- **One exchange at a time, at most one request per `PROBE_MIN_INTERVAL_MS`.** A probe while one
  runs joins it. `signInWithGoogle` probes before the sheet and reads the answer after it, and
  `pause()` never waits for a probe, so the student never waits on one.

## Getting a debug token into the iOS simulator

In a `__DEV__` build, this is the only path that reliably decides which debug token is used:

```text
.env (FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS / _ANDROID)
  → app.config.ts extra
  → src/platform/app-check.ts provider.configure({ apple: { debugToken } })
```

- **The mechanism.** RN Firebase calls `setenv("FIRAAppCheckDebugToken", value)`, and
  AppCheckCore reads the token from that env path.
- **Do not trust the UserDefaults fallback.** Writing `GACAppCheckDebugToken` into UserDefaults is
  silently ignored on the iOS simulator with this Expo prebuild: no error, and an automatically
  generated token is used instead.
- **No build or update contains the token.** `app.config.ts` adds it to the extras only when
  neither `EAS_BUILD_PROFILE` nor `RELEASE_CHANNEL` is set, so every EAS build profile and every
  OTA publish leaves it out, and a release path it does not know fails safe.
- **No dev server serves the token.** Metro hands the app config, extras included, to anyone who
  can reach it. So the extras hold the token only when expo-constants' build script evaluates
  `app.config.ts`, which Xcode and Gradle run on every native build, by any route, and Metro never
  does. A build without a dev client reads the extras compiled into it, never Metro's. An
  environment variable could not draw this line, since a Metro started in the same shell inherits it.
- **A failed exchange on a simulator: check the registration first.** The token under App Check,
  the iOS app, Manage debug tokens in the Firebase console must be exactly the one in `.env`.

## Play Integrity throttling (-8) and `primeAppCheck`

Every Firestore write calls `primeAppCheck` first, which steers between two failures:

- **Attesting on every write is throttled.** A forced refresh attests each time, and Play
  Integrity attestations have a quota, so one per write hits -8 in a burst such as onboarding's
  sign-in, device registration, seed and toggles. A failed seed there is what the onboarding gate
  guards against ([fcm-architecture.md](fcm-architecture.md#the-onboardedat-discriminator)).
- **Writing on a stale token stalls.** With an expired token the local cache takes the write and
  `onSnapshot` echoes it, but the write stays in the pending-writes queue until the app restarts.

So `primeAppCheck` takes the token the SDK holds (`getToken(appCheck, false)`, which attests only
near expiry) and forces a new one only once less than half of that token's own lifetime is left
(`shouldForceRefresh`), just ahead of the SDK's own refresh. A forced refresh re-arms the SDK's
timer, and both SDKs join a concurrent request, so the two never attest twice for one token.

- **One clock for every write path.** The refresh clock is module state in `app-check.ts`, so the
  quota is counted once. A per-file copy would spend it twice.
- **A failed prime is swallowed.** The write goes out on the cached token rather than blocking on
  a bad network, and the caller's retry handles the write's own failure.

> [!WARNING]
> Play Integrity can only be verified on its real path with an Android **beta profile** build. A
> dev build uses the debug provider, so it proves nothing.
