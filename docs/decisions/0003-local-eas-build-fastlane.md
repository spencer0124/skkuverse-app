---
title: Local EAS Build + Fastlane over EAS Cloud
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
audience: internal
---

# 0003. Build locally with EAS and Fastlane rather than in the cloud

## Status

Accepted — decided while setting up the build pipeline. The exact date was not recorded;
this entry was written on 2026-07-21.

## Context

An Expo app can reach the stores either through EAS cloud builds or through
`eas build --local` followed by a Fastlane upload. Cloud builds cost credits and hand over
control of the build environment, including the cache, the toolchain, and how secrets are
injected. A solo setup has a macOS machine available at all times.

## Decision

**Build and release entirely locally, with EAS Build `--local` and Fastlane.** EAS cloud builds
are not used.

- The entry points are `apps/mobile/scripts/{ios,android}-{build,beta,release}.sh`.
- Credentials are managed locally in `credentials.json` (iOS dist.p12 and mobileprovision,
  Android upload-keystore.jks), with `"credentialsSource": "local"` on the `eas.json`
  production profile.
- Fastlane uploads to TestFlight, the App Store, Play internal testing, and a Play
  production draft. Release notes come from the per-locale files under `fastlane/metadata/`.

## Consequences

- (+) No build cost, full control of the build environment, and no cloud queue.
- (+) `autoIncrement: true` still works under `--local`, so versioning stays with the EAS
  remote version.
- (−) **`.easignore` becomes a maintenance burden.** It replaces `.gitignore` for the build,
  so the Firebase config and `certs/certificate.pem` have to stay *included*. Excluding one by
  accident breaks the artifact silently, and the file has to be kept in step with `.gitignore`
  by hand. It cuts both ways: `.env` has to stay *excluded*, since omitting a line there is
  what includes a file, and that file holds the App Check debug tokens.
- (−) The cloud's automatic `expo-channel-name` header is absent, so
  `updates.requestHeaders` in `app.config.ts` has to set it by hand.
- (−) **A monorepo trap.** Some combinations break the embedded bundle inside the EAS local
  sandbox with `ARCHIVE FAILED`. It needs `EXPO_NO_METRO_WORKSPACE_ROOT=1` in `eas.json`
  and a symlink-free `TMPDIR` in the iOS script. Details are in the troubleshooting section
  of [../how-to/ios-build-deploy.md](../how-to/ios-build-deploy.md).
- (−) Reproducibility now depends on one machine's state. Replacing it means setting up
  JDK 17, `ANDROID_HOME` and the certificates again.
