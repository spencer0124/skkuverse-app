---
title: Android Native Library Loading
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-15
audience: internal
---

# Android Native Library Loading

> Why the Android build extracts its native libraries at install time (`useLegacyPackaging`), and the SoLoader ABI mismatch that crashes the app on launch without it. Read this before touching Android packaging options.

## Context

With native libraries left inside the APK, some devices crash in `MainApplication.onCreate`
before any JavaScript runs:

```text
SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so   (or libc++_shared.so)
  SoSource 0: ApplicationSoSource[DirectorySoSource[root = .../lib/x86_64]]
  SoSource 1: DirectApkSoSource[root = [.../split_config.arm64_v8a.apk!/lib/arm64-v8a, ...]]
```

Crashlytics showed two shapes of it, and both are an ABI disagreement:

| Installed library dir (SoSource 0) | Searched inside the APKs (SoSource 1) | Device signature |
| --- | --- | --- |
| `lib/x86_64` | `!/lib/arm64-v8a` | Spoofed model names on Android 11. One install hash reported two different models |
| `lib/arm64` | `!/lib/x86_64` | An x86_64 emulator image advertising arm64 to Play |

Both are x86_64 Android running ARM translation, which is what PC emulators are. A real arm64
phone reports the same ABI to both sides and never hits this.

## Mechanism

The package manager clears `FLAG_EXTRACT_NATIVE_LIBS` when the build uses
`useLegacyPackaging=false`. SoLoader then builds its source list in this order:
`DirectApkSoSource`, then `ApplicationSoSource`, then the system directories. It also skips
the backup source, because it can load straight from the APK. The following refer to
SoLoader at the version React Native pins in `node_modules/react-native/gradle/libs.versions.toml`.

1. **`ApplicationSoSource` is empty.** It points at `nativeLibraryDir`, the directory for the
   ABI the package manager chose, and nothing was extracted into it.
2. **`DirectApkSoSource` looks under one ABI only.** `getFallbackApkLdPath` appends
   `!/lib/` plus `SysUtil.getSupportedAbis()[0]` to the base APK and every split. That is
   `Build.SUPPORTED_ABIS` filtered by process bitness, and it does not consult the ABI the
   package manager chose.
3. **The two disagree on a translating emulator.** When the emulator lists `arm64-v8a`
   first but the package manager chose `x86_64`, or the reverse, step 2 searches an ABI
   directory that is absent, or that holds a library the process cannot `dlopen` from a zip.
4. **The link error is swallowed.** An `UnsatisfiedLinkError` in
   `DirectApkSoSource.loadLibrary` becomes `continue`, so the report reads "not found"
   rather than naming the load failure.

## The fix

`useLegacyPackaging: true` in the `expo-build-properties` plugin in
`apps/mobile/app.config.ts`. Prebuild writes `expo.useLegacyPackaging=true` into
`android/gradle.properties`, which the generated `app/build.gradle` feeds to
`packaging.jniLibs.useLegacyPackaging`.

The package manager then extracts the chosen ABI's libraries into `nativeLibraryDir`,
`DirectApkSoSource` is never added, and `ApplicationSoSource` finds every library in the
directory that matches the installed ABI by construction. `SUPPORTED_ABIS` order stops
mattering.

## Rationale and trade-offs

| Option | Outcome |
| --- | --- |
| `useLegacyPackaging: true` | Chosen. Covers both shapes, is a single config line, and changes no code |
| Drop `x86` and `x86_64` from `reactNativeArchitectures` | Does not fix the second shape, which still searches `!/lib/x86_64`, and breaks x86 emulators for development |
| Custom `SoLoader.init` flags in `MainApplication` | Needs a config plugin patching generated code, and the backup source filters by the same ABI list |

- **Size.** Libraries are stored compressed in the APK and extracted on install, so the
  device holds both copies. Measure from a built AAB rather than trusting a figure here:
  compare `base/lib/<abi>/` raw bytes against the same bytes deflated.
- **Startup.** No extra work on a healthy device. The backup source is constructed but
  prepared only on the not-found recovery path, since init passes
  `PREPARE_FLAG_SKIP_BACKUP_SO_SOURCE`.
- **Not covered.** An install carrying `base.apk` alone, sideloaded without its ABI split,
  has no library to extract and still crashes. That shape shows as a `DirectApkSoSource`
  root listing `base.apk` alone.
- **Shipping.** Packaging is native, so only a new store build carries it. The JS-to-native
  surface is unchanged, so it does not affect OTA compatibility.

## Verification

The crash cannot be reproduced on an Apple silicon emulator, which is arm64 end to end. So
the check runs in two parts:

1. After `npx expo prebuild --clean`, `android/gradle.properties` carries
   `expo.useLegacyPackaging=true`.
2. After the store build ships, the Crashlytics issue for `MainApplication.onCreate` stops
   receiving events on the new version. A new event there with split APKs listed means this
   explanation is incomplete.

## Related

- [android-build-deploy.md](../how-to/android-build-deploy.md) for the store build
- [facebook/react-native#55562](https://github.com/facebook/react-native/issues/55562), the
  upstream report, including the confirmation that this setting fixed the second shape
- [docs/README.md](../README.md) for the writing rules
