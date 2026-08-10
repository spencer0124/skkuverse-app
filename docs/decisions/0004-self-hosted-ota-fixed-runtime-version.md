---
title: Self-Hosted OTA with Fixed-String runtimeVersion
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# 0004. Self-hosted expo-open-ota with a fixed-string runtimeVersion

## Status

Accepted — decided while building the OTA infrastructure. The exact date was not recorded;
this entry was written on 2026-07-21. The eoas version was pinned in 2026-07, commit
`54153d9`.

## Context

Releasing JS-only changes without a store review needs OTA updates. Having already chosen to
self-host rather than use EAS Update, two sub-decisions remained.

**The runtimeVersion policy.** Expo can derive it as a fingerprint by hashing the native
code. The alternative is a fixed string maintained by hand. The fingerprint route had a
hash mismatch between EAS build and eoas, the expo-open-ota CLI, so the same native build
could be assigned two different runtimes.

**The eoas CLI version.** An unpinned `npx eoas` follows major version jumps as they land,
which can break the deploy scripts without warning. It did, which is what commit `54153d9`
is.

## Decision

- Run a self-hosted expo-open-ota server at `https://ota.skkuverse.com`.
- **Keep runtimeVersion a fixed string**, defined in `apps/mobile/app.config.ts`. Do not use
  the fingerprint route.
- **Separate the channels.** A `*-beta.sh` build goes to the "beta" channel and a
  `*-release.sh` build to "production", with `app.config.ts` choosing from the
  `EAS_BUILD_PROFILE` environment variable. The workflow is an OTA to beta, then
  verification, then an OTA to production.
- **Bump runtimeVersion by hand whenever native code changes**: a new native module, an SDK
  upgrade, or a change to plugins. Bumps happen only on an explicit instruction, never
  automatically.
- **Pin the eoas version** (commit `54153d9`; the value itself is in the script) so an
  unpinned `npx` cannot jump a major version underneath a release.

## Consequences

- (+) Full control of the OTA server and its channels, with no dependency on EAS Update and
  no cost.
- (+) A fixed string makes "which runtime is this build" a decided question, which removes
  the whole class of updates that reach the wrong binaries because two fingerprints
  disagreed.
- (−) **The manual bump is the only defense.** Add a native module, forget the bump, and an
  older native binary can receive JS that hard-imports something it does not have, crashing
  at import time. A human carries that risk, so a native-change review has to confirm the
  bump.
- (−) The server has to be operated: availability, and the `EXPO_TOKEN` credential kept in
  `.env.ota.local`.
- The pinned eoas version needs revisiting at each SDK upgrade, since its compatible range
  moves.

Related: [../how-to/ota-update.md](../how-to/ota-update.md).
