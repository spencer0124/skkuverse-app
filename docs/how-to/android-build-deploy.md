---
title: Android Build & Deploy
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
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
| `.env` | excluded | **included** | The `EXPO_PUBLIC_*` variables |

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

### The build aborts on EXPO_PUBLIC_BASE_URL

`app.config.ts` guards that variable and throws rather than producing a config — missing, empty or
whitespace-only always fails, and a local host (`localhost`, `127.0.0.1`, `10.0.2.2`, or any
`http://` scheme) additionally fails under `EAS_BUILD_PROFILE` `beta` or `production`. Point
`apps/mobile/.env` back at the deployed API host. The same entry in
[ios-build-deploy.md](ios-build-deploy.md) has the full reasoning.

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

## Related

- [ios-build-deploy.md](../how-to/ios-build-deploy.md) — the iOS half of the same pipeline,
  including the shared monorepo traps
- [ota-update.md](../how-to/ota-update.md) — publishing an OTA, which follows the same beta
  and production channels
- [docs/README.md](../README.md) — the writing rules
