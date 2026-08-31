---
title: Android Build & Deploy
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-31
audience: internal
---

# Android Build & Deploy

> The runbook for building the Android app locally with EAS Build `--local` and uploading it to Google Play internal testing or production with Fastlane supply. Read this before running an Android release.

## Overview

An Expo CNG project, the same as iOS. **EAS Build (`--local`)** produces the artifact and
**Fastlane supply** uploads it. EAS cloud builds are not used.

```text
apps/mobile/
├── scripts/
│   ├── android-build.sh          # build only
│   ├── android-beta.sh           # build + GP internal testing
│   └── android-release.sh        # build + GP production (draft)
├── fastlane/
│   ├── Fastfile                  # the android upload_beta and upload_release lanes
│   └── play-store-key.json       # Google Play service account key
├── certs/
│   └── upload-keystore.jks       # upload keystore, carried over from Flutter
├── credentials.json              # EAS local credentials config, iOS and Android
├── Gemfile                       # Fastlane dependencies
└── eas.json                      # EAS Build profiles
```

> [!NOTE]
> Running on an emulator during development has nothing to do with this pipeline:
> `cd apps/mobile && npx expo run:android`.

## Prerequisites

### Build environment

The build scripts set these up, but a manual build needs them checked:

| Item | Requirement |
| --- | --- |
| JDK | 17 or newer (`/usr/libexec/java_home -v 17`) |
| ANDROID_HOME | `~/Library/Android/sdk` |
| jq | `brew install jq`, used for the version increment |

### Credentials

| Item | Value |
| --- | --- |
| Package name | `com.zoyoong.skkubus` |
| Keystore | `certs/upload-keystore.jks`, the same key carried over from Flutter |
| Key alias | `upload` |
| EAS project ID | `43e326a2-2f25-4317-a341-a107a52c5405` |

**The Google Play service account key** is `fastlane/play-store-key.json`, a service account
JSON key created in the Google Cloud console. To test the connection:

```bash
bundle exec fastlane run validate_play_store_json_key json_key:fastlane/play-store-key.json
```

### .easignore

The same `.easignore` as iOS, applied in place of `.gitignore`. The Firebase config files
have to reach the build:

| File | .gitignore | .easignore | Why |
| --- | :---: | :---: | --- |
| `google-services.json` | excluded | **included** | Android Firebase config |
| `.env` | excluded | excluded | Holds the App Check debug tokens, which are real secrets and must not ride into an archive |

The full reasoning, and why the build needs nothing from `.env`, is in the `.easignore` section of
[ios-build-deploy.md](ios-build-deploy.md).

### Versioning happens by itself

- `eas.json` sets `appVersionSource: "remote"`, so EAS keeps the build number.
- `autoIncrement: true` is on for both the beta and production profiles, and it does work
  under `--local`.
- Each build increments the current number by one before building, so there is nothing to
  maintain by hand.
- EAS tracks the platforms independently, so the iOS buildNumber and the Android versionCode
  move separately.
- The starting point was 100, chosen to sit above Flutter's last versionCode of 67.
- To read the current number:

  ```bash
  eas build:version:get -p android --non-interactive --json
  ```

## Steps

1. **Update the release notes.** These are the changes shown on Google Play. Edit the
   per-locale `default.txt` under `fastlane/metadata/android/` and it is included
   automatically at upload. Leaving them alone re-uploads whatever is there. The limit is 500
   characters.

   ```text
   fastlane/metadata/android/
   ├── ko-KR/changelogs/default.txt    ← Korean
   ├── en-US/changelogs/default.txt    ← English
   └── zh-CN/changelogs/default.txt    ← Chinese
   ```

2. **Run the build and upload script**

   ```bash
   cd apps/mobile

   ./scripts/android-build.sh     # build the .aab only
   ./scripts/android-beta.sh      # build and upload to Google Play internal testing
   ./scripts/android-release.sh   # build and upload to Google Play production as a draft
   ```

   Each script runs in two stages.

   **Stage 1, EAS Build (`--local`):**

   ```bash
   eas build --platform android --profile production --local --non-interactive --output ./build.aab
   ```

   - Compresses the project into a `.tar.gz` and builds it in a temporary directory.
   - Injects the signing config from the keystore details in `credentials.json`. Under CNG
     there is no build.gradle to edit by hand.
   - Produces `build.aab`, an Android App Bundle.

   **Stage 2, the Fastlane upload:**

   ```bash
   bundle exec fastlane android upload_beta aab:"./build.aab"       # internal testing
   bundle exec fastlane android upload_release aab:"./build.aab"    # production (draft)
   ```

   - Authenticates with the Google Play service account key, `play-store-key.json`.
   - `upload_beta` goes to the internal track and releases immediately, matching TestFlight.
   - `upload_release` goes to the production track as a draft, which still needs releasing by
     hand.

## Troubleshooting

### JAVA_HOME invalid directory

The build scripts include `export JAVA_HOME="$(/usr/libexec/java_home -v 17)"`. For a manual
build, check that JDK 17 is installed.

### Which API host does the artifact get?

Always `PROD_API_URL` from `apps/mobile/config/constants.js`. `EXPO_PUBLIC_BASE_URL` is not read at
all on a shipping profile, so nothing in the environment can point a release at a dev host, and
there is no build-time abort on that variable to recognise. The
[ios-build-deploy.md](ios-build-deploy.md) entry of the same name has the full reasoning and the
`expo config` command for checking it without running a build.

### SDK location not found

The build scripts include
`export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"`. If the Android SDK is
somewhere other than `~/Library/Android/sdk`, set the path directly.

### The first supply upload fails

Fastlane's `supply` needs the app to have been uploaded to the Play console by hand at least
once. Having already published it from Flutter satisfies that.

### versionCode conflict

The number has to start above Flutter's last versionCode of 67. Read the current value with
`eas build:version:get -p android`.

### splashscreen_logo not found

The `expo-splash-screen` plugin always adds a reference to `@drawable/splashscreen_logo` in
`styles.xml`. Without an `image` in `app.config.ts`, the drawable is never generated and the
build fails:

```text
error: resource drawable/splashscreen_logo (aka com.zoyoong.skkubus:drawable/splashscreen_logo) not found.
```

**The fix** is to always set the `image` field in the `expo-splash-screen` config. For a plain
white background with no icon, point it at `transparent_1x1.png`:

```ts
["expo-splash-screen", { backgroundColor: "#ffffff", image: "./assets/images/transparent_1x1.png" }]
```

### The build succeeds but the script exits 1, and nothing is uploaded

EAS writes the artifact, prints `Build successful`, and then fails while deleting its own
temp directory:

```text
[PREPARE_ARTIFACTS] Writing artifacts to .../build.aab
Build successful
ENOTEMPTY: directory not empty, rmdir '.../eas-build-local-nodejs/<uuid>/build/.git'
```

The `.aab` is finished and valid. Only the cleanup failed. But it exits non-zero, and
`android-release.sh` runs under `set -euo pipefail`, so the script aborts at the `eas build`
line and **never reaches the `fastlane` line below it**. The symptom is a release that looks
failed while a complete artifact sits in `apps/mobile/`.

Do not rebuild. Upload the artifact that already exists:

```bash
cd apps/mobile
bundle exec fastlane android upload_release aab:"./build.aab"   # or upload_beta
```

Check `fastlane/report.xml` afterwards: a `<testcase>` for `upload_to_play_store` with no
`<failure>` child is the upload succeeding. That file is the reliable signal, because piping
a build script through `tail` masks its exit code with the pager's.

### An image asset fails AAPT with "file failed to compile"

```text
Execution failed for task ':app:mergeReleaseResources'.
> ERROR: .../assets_video_subsposter.png: AAPT: error: file failed to compile.
```

The file's extension disagrees with its actual contents — typically JPEG data named `.png`.
AAPT trusts the extension and refuses; nothing else in the toolchain does, which is why such a
file can sit in the repo for a long time before anyone sees this:

- **iOS never notices.** Apple's toolchain reads the file header, so the asset builds and ships.
- **Android debug never notices.** Metro serves the asset, so it never passes through AAPT.
  Only `mergeReleaseResources` in a release build does.

So a mismatch is invisible to local development and to the entire iOS pipeline, and surfaces
only on an Android store build. Find any others with:

```bash
cd apps/mobile/assets
find . -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.webp' \) -exec file {} +
```

Rename the file to match what it actually is and update the `require`, rather than re-encoding
it: a photograph re-encoded to a true PNG grows by an order of magnitude for no benefit.

### `expo run:android` cannot build this project

It fails to resolve a dependency that is present on disk:

```text
Could not find any matches for app.notifee:core:+ as no versions of app.notifee:core are available.
```

`expo run:android` passes `--configure-on-demand`. Notifee registers its bundled local Maven
repository from inside its own `build.gradle`, so under configure-on-demand `:app` resolves its
classpath before that registration has happened and only the remote repositories are searched.
A full-configuration build has no such ordering problem:

```bash
cd apps/mobile
./android/gradlew -p android app:assembleDebug -x lint -x test \
  -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=arm64-v8a
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Release builds are unaffected**, because EAS does not pass the flag. This is a local
development-loop problem only.

### The build is killed, or CMake cannot write its cache

```text
CMake Error: Cannot open file for write: .../CMakeCache.txt.tmp
CMake Error: : System Error: Inappropriate ioctl for device
```

Check free disk space first. A local EAS build unpacks the project, installs dependencies and
compiles native code for every ABI, and each attempt leaves its working directory behind under
`$TMPDIR/eas-build-local-nodejs/<uuid>/`. Several failed attempts accumulate quickly, and a full
volume presents as either this CMake error or the build being killed mid-compile rather than as
anything mentioning space.

Reclaim the build caches, all of which are regenerated on the next build:

```bash
rm -rf "${TMPDIR}eas-build-local-nodejs" ~/.eas-build-tmp
rm -rf ~/Library/Developer/Xcode/DerivedData/<this-project>-*   # if iOS has also been built here
```

## Related

- [ios-build-deploy.md](../how-to/ios-build-deploy.md) — the iOS half of the same pipeline,
  including the shared monorepo traps
- [ota-update.md](../how-to/ota-update.md) — publishing an OTA, which follows the same beta
  and production channels
- [docs/README.md](../README.md) — the writing rules
