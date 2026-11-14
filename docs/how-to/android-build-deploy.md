---
title: Android Build
type: how-to
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Android Build

> How the version code and the native crash symbols move in a local Android release build (EAS Build `--local`), and the failures that build meets in this repository. A contributor runs the app with `yarn android` instead. The maintainers make store releases from outside this repository.

The build produces an Android App Bundle and signs it with the maintainers' local credentials,
which a contributor does not have. The machine set-up is the one in
[getting-started.md](../tutorials/getting-started.md). `.easignore`, the API host and the monorepo
settings are shared with iOS: see the Build section of the root `CLAUDE.md` and
[ios-build-deploy.md](ios-build-deploy.md).

```bash
eas build --platform android --profile production --local --non-interactive --output ./build.aab
```

## The version code

`eas.json` sets `appVersionSource: "remote"` and `autoIncrement: true` on the beta and production
profiles, and both work under `--local`: EAS keeps the version code and raises it before each
build. It counts the Android version code and the iOS build number separately. To read it:

```bash
eas build:version:get -p android --non-interactive --json
```

## Native crash symbols

The beta and production profiles in `eas.json` name `:app:uploadCrashlyticsSymbolFileRelease` in
`gradleCommand`, so every release build uploads the NDK symbols of its own `.so` files to
Crashlytics. Without them a native crash shows there as `lib*.so + 0x...` only.
`apps/mobile/plugins/withCrashlyticsNativeSymbols.js` registers the task.

- The upload needs outbound network access, and no credential beyond the app ID that
  `google-services.json` carries.
- Symbols are matched by build ID, so they come from the build that is released, never from a rebuild of
  the same commit.

## Troubleshooting

### The build fails at uploadCrashlyticsSymbolFileRelease

The upload is part of the Gradle command, so when it fails (no network, a Firebase outage) EAS
fails the whole build and writes no `.aab`. Retry once the network is back.

If a release cannot wait, drop the task from the profile's `gradleCommand` for that one build. The
AAB still carries Play's symbol tables, under
`BUNDLE-METADATA/com.android.tools.build.debugsymbols/<abi>/`. Crashlytics can take function
names, without lines, from them afterwards: rename each `*.so.sym` to `*.so`, then run
`firebase crashlytics:symbols:upload --app=<mobilesdk_app_id> <abi-dir>` once per ABI.

### splashscreen_logo not found

```text
error: resource drawable/splashscreen_logo (aka com.zoyoong.skkubus:drawable/splashscreen_logo) not found.
```

The `expo-splash-screen` plugin always references `@drawable/splashscreen_logo` in `styles.xml`,
and the drawable is generated only from an `image` in its config. Keep the `image` field in
`app.config.ts`. A plain background with no icon points it at
`./assets/images/transparent_1x1.png`.

### An image asset fails AAPT with "file failed to compile"

```text
Execution failed for task ':app:mergeReleaseResources'.
> ERROR: .../assets_video_subsposter.png: AAPT: error: file failed to compile.
```

The file's extension disagrees with its contents, typically JPEG data in a file whose name ends in `.png`. AAPT trusts
the extension and refuses. Only `mergeReleaseResources` in an Android release build runs AAPT:
Apple's toolchain reads the file header, and an Android debug build gets the asset from Metro. So
the mismatch can sit in the repo unseen until a store build. Find any others with:

```bash
cd apps/mobile/assets
find . -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.webp' \) -exec file {} +
```

Rename the file to match its contents and update the `require`, rather than re-encoding it: a
photograph re-encoded as a true PNG grows by an order of magnitude.

## Related

- [ota-updates.md](../explanation/ota-updates.md) — how the app updates its JS bundle without a
  store release
