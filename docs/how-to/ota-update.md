---
title: OTA Update
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# OTA (Over-The-Air) Update

> The runbook for publishing a JS bundle without a store review, using `expo-updates` against a self-hosted `expo-open-ota` server. Read this before publishing an OTA update, or when debugging the server or client behaviour.

## Overview

An `expo-updates` client paired with a self-hosted `expo-open-ota` server. An OTA replaces
**the JS bundle only**. A native change needs a rebuild and another store release. See "when
a native build is required" below.

- **Server:** `https://ota.skkuverse.com`, on OCI Free Tier A1, in Docker
- **Dashboard:** `https://ota.skkuverse.com/dashboard/`
- **Infrastructure repo:** `skkuverse-codepush`

### Channels

- The `beta` channel reaches apps built by `ios-beta.sh` or `android-beta.sh`, meaning
  TestFlight and Internal Testing.
- The `production` channel reaches apps built by `ios-release.sh` or `android-release.sh`,
  meaning the App Store and Play Store.
- The channel is decided **at build time** by the `EAS_BUILD_PROFILE` variable in
  `app.config.ts`, so an existing build's channel cannot be changed.

### When a native build is required

None of these can travel over OTA. Each needs a native rebuild and another store release:

- Changing the plugins, ios or android sections of `app.config.ts`
- Adding or removing a native module
- Upgrading the Expo SDK
- Changing `runtimeVersion`

Bump `runtimeVersion` when rebuilding, so the new binary does not collide with existing OTA
updates.

### The client update strategy

**When it downloads:**

| Scenario | Behaviour |
| --- | --- |
| Cold start | `checkAutomatically: ON_LOAD`, with the check on the custom splash |
| Returning after 5 minutes or more in the background | Custom splash, check, download, apply |
| Returning after less than 5 minutes | Downloads quietly, with no splash |

**How it applies:**

```text
custom splash → check for an update (10s timeout)
├─ none → straight into the app
└─ found → download → reloadAsync() → restart → into the app
    └─ timed out → into the app on the existing bundle, applying next time
```

**Where it lives:**

| File | Role |
| --- | --- |
| `src/hooks/useOTAUpdate.ts` | The check, download and apply hook. Swallows errors, no-ops in dev |
| `src/providers/InitGate.tsx` | The custom splash, the OTA flow, and background return handling |

### Server layout

```text
OCI A1 (ARM64, 4 OCPU, 24GB)
├── Docker: ghcr.io/axelmarciano/expo-open-ota:latest (port 3010)
├── Nginx: ota.skkuverse.com → 127.0.0.1:3010
├── SSL: Cloudflare origin certificate
├── Storage: the local filesystem (./updates)
└── Code signing: RSA keys (./keys)
```

**Server environment variables (.env):**

| Variable | Description |
| --- | --- |
| `BASE_URL` | `https://ota.skkuverse.com` |
| `EXPO_ACCESS_TOKEN` | An Expo API token |
| `EXPO_APP_ID` | The EAS project id |
| `JWT_SECRET` | Dashboard authentication |
| `ADMIN_PASSWORD` | The dashboard login password |
| `STORAGE_MODE` | `local`, switchable to `s3` later |
| `USE_DASHBOARD` | `true` |

## Prerequisites

- **The working tree has to be clean**, so commit first. eoas checks for a dirty tree and
  refuses.
- **Check that `runtimeVersion` matches the runtime of the build actually in the store.**
  When it does not, publishing succeeds without an error and **no device receives it**, a
  silent no-op. The repo's runtimeVersion may already be bumped ahead for an unreleased
  native build. On 2026-07-29 the repo was at 3.5.5 against a released build at 3.5.4, and
  four publishes went nowhere. To read the runtime of real devices:

  ```bash
  ssh oracle "docker compose -f /opt/skkuverse-codepush/docker-compose.yml logs --since 1h | grep -o 'Expo-Runtime-Version:\[[^]]*\]' | sort | uniq -c"
  ```

  On a mismatch, branch from the commit of the last OTA tag the released build accepted,
  where the tree's runtimeVersion matches, cherry-pick only what is needed, and publish from
  there. Never publish the current repo bundle against the older runtime: code added since
  then that uses a new native module, such as the splash screen's LinearGradient, can
  **crash the app at boot**.
- **`EXPO_TOKEN`** lives in `.env.ota.local`, which is gitignored, and the scripts read it
  automatically. Without one, create it at [expo.dev](https://expo.dev) under Settings,
  Access tokens, and add `EXPO_TOKEN=<token>` to `.env.ota.local`.
- Check that the `updates` config in `app.config.ts` has this shape. The real
  `runtimeVersion` value is in `apps/mobile/app.config.ts`.

  ```ts
  runtimeVersion: "<runtime-version>", // A fixed string, bumped by hand only on a native change
  updates: {
    url: "https://ota.skkuverse.com/manifest",
    enabled: true,
    fallbackToCacheTimeout: 0,
    requestHeaders: {
      // EAS_BUILD_PROFILE=beta gives "beta", anything else "production"
      "expo-channel-name": process.env.EAS_BUILD_PROFILE === "beta" ? "beta" : "production",
    },
    codeSigningCertificate: "./certs/certificate.pem",
    codeSigningMetadata: {
      keyid: "main",
      alg: "rsa-v1_5-sha256",
    },
  },
  ```

  - **runtimeVersion** is a fixed string. `{ policy: "fingerprint" }` is avoided because of a
    hash mismatch between EAS build and eoas. A native change means bumping it by hand.
  - **expo-channel-name** is decided at build time from `EAS_BUILD_PROFILE`, where
    `--profile beta` gives `"beta"` and `--profile production` gives `"production"`. Without
    this header the server returns 400. Only EAS cloud injects it automatically, so **a local
    build has to set `requestHeaders` by hand**.

> [!NOTE]
> The publish scripts pass `--platform ios` to work around a lottie-react-native web export
> issue.

## Steps

1. **Publish to beta first**, which reaches TestFlight and Internal Testing users alone.

   ```bash
   cd apps/mobile
   ./scripts/ota-beta.sh
   ```

2. **Verify on a beta build.** Restart the TestFlight or Internal Testing app and confirm the
   update applies.

3. **Publish to production**, which reaches App Store and Play Store users alone.

   ```bash
   cd apps/mobile
   ./scripts/ota-release.sh
   ```

## Troubleshooting

### "Error validating expo auth" when publishing

`EXPO_TOKEN` is missing. Check that the token is in `.env.ota.local`. Without one, create it
at [expo.dev](https://expo.dev) under Settings, Access tokens, and add
`EXPO_TOKEN=<token>` to `.env.ota.local`.

### "No channel name provided" (400) in the server log

The app is not sending the `expo-channel-name` header. Add it to `updates.requestHeaders` in
`app.config.ts`, which needs a native rebuild.

### The app never receives an update

Substitute the real value for `<runtime-version>`, which is the `runtimeVersion` in
`apps/mobile/app.config.ts`.

1. Server health check:

   ```bash
   curl https://ota.skkuverse.com/hc
   ```

2. The manifest response:

   ```bash
   curl -H "expo-channel-name: beta" -H "expo-platform: ios" -H "expo-runtime-version: <runtime-version>" -H "expo-protocol-version: 1" https://ota.skkuverse.com/manifest
   ```

3. Server logs:

   ```bash
   ssh oracle "docker compose -f /opt/skkuverse-codepush/docker-compose.yml logs --tail 20"
   ```

4. Confirm which channel and runtimeVersion the app is asking for, by reading the
   `Expo-Channel-Name` and `Expo-Runtime-Version` headers in the server log.

### runtimeVersion mismatch, meaning "No update found"

When the runtimeVersion of the published OTA differs from the app's, nothing updates. Check
`runtimeVersion` in `app.config.ts`, then rebuild natively and put the new build on
TestFlight or the Play Store.

## Related

- [ios-build-deploy.md](../how-to/ios-build-deploy.md) — the iOS build scripts, which decide
  the beta or production channel
- [android-build-deploy.md](../how-to/android-build-deploy.md) — the Android build scripts,
  which do the same
- [docs/README.md](../README.md) — the writing rules, including the one against copying values
