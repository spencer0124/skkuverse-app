---
title: App Check
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# App Check

> How Firebase App Check providers are configured, how a debug token reaches the iOS simulator and why only the env path works, and the trade-off between Play Integrity throttling (-8) and `primeAppCheck`. Read this before touching App Check code or debugging a failed Firestore write.

## Configuration

The provider setup is in `apps/mobile/src/services/app-check.ts`:

| Platform | `__DEV__` | Production |
| --- | --- | --- |
| iOS | `debug` provider with a debug token | `appAttestWithDeviceCheckFallback`, meaning App Attest |
| Android | `debug` provider with a debug token | `playIntegrity` |

## Getting a debug token into the iOS simulator

In a `__DEV__` build, this is the only path that reliably decides which debug token is used:

```text
.env (FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS / _ANDROID)
  → app.config.ts extra
  → src/services/app-check.ts provider.configure({ apple: { debugToken } })
```

- **The mechanism.** RN Firebase calls `setenv("FIRAAppCheckDebugToken", value)` internally,
  and AppCheckCore reads the token from that **env path**.
- **Do not trust the UserDefaults fallback.** Writing `GACAppCheckDebugToken` into
  UserDefaults is **silently ignored on the iOS simulator with this Expo prebuild**,
  reproduced and confirmed on 2026-04-22. There is no error: a different, automatically
  generated token is simply used instead.
- **Production is safe.** With `EAS_BUILD_PROFILE=beta|production`, the debug token is
  **stripped automatically** from the `app.config.ts` extras, so it cannot leak into a public
  repo or a production bundle.

### Troubleshooting a failed token exchange on the simulator

When the exchange fails on a simulator, check the Firebase console registration **first**:

1. Firebase console, App Check, the iOS app, **Manage debug tokens**.
2. Confirm the **exact same UUID** as in `.env` is registered. A typo or a stray space is the
   usual cause.

## Play Integrity throttling (-8) and `primeAppCheck`

### What happened

An earlier implementation **force-refreshed** the App Check token on every Firestore write,
with `getToken(true)`. A force refresh calls the Play Integrity attestation API each time,
and that API has a quota, so a burst of writes during onboarding (sign in, register the
device, seed, toggle) hit the -8 throttle. A seed write failing at that moment was the
trigger for the "ghost preferences" bug. The details are in the
[postmortem](../internal/2026-07-notices-picker-ghost-state.md).

### The fix (commit `78985ee`)

Everything moved into **one module**, `apps/mobile/src/services/app-check-prime.ts`,
replacing the three copies that had grown in notifications, bookmarks and feedback:

- A force refresh happens once per interval, `FORCE_REFRESH_INTERVAL_MS` in that file, which
  was five minutes when this was written. Writes in between use `getToken(false)`, where the
  SDK reuses a valid cached token and no Integrity call happens.
- The refresh timestamp is a single module-level piece of state. Every write path has to
  share this one function for the throttle budget to be accounted for together, so **no
  per-file copies**.
- Why a token is fetched before a write at all, which is an SDK bug where a stale token traps
  the write in the pending-writes queue, and the full trade-off, are documented in the
  comment at the top of `app-check-prime.ts`, which is the authority.

> [!WARNING]
> Play Integrity can only be verified on its real path with an Android **beta profile**
> build. A dev build uses the debug provider, so it proves nothing.

## Related

- [internal/2026-07-notices-picker-ghost-state.md](../internal/2026-07-notices-picker-ghost-state.md)
  — the ghost preferences postmortem, where the throttle was the trigger
- [fcm-architecture.md](fcm-architecture.md) — the Firestore write paths App Check protects,
  covering preferences and devices
