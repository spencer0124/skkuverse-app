---
title: iOS Build & Deploy
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
audience: internal
---

# iOS Build & Deploy

> The runbook for building the iOS app locally with EAS Build `--local` and uploading it to TestFlight or the App Store with Fastlane. Read this before running an iOS release.

## Overview

This is an Expo CNG project, so there is no Xcode project in the repo. Building and uploading
are deliberately separate: **EAS Build (`--local`)** produces the artifact, and **Fastlane**
uploads it. The reason for the split is that calling eas build from Fastlane's Ruby
environment causes a CocoaPods PATH problem, covered in the troubleshooting section. EAS
cloud builds are not used.

```text
apps/mobile/
├── scripts/
│   ├── ios-build.sh          # build only
│   ├── ios-beta.sh           # build + TestFlight
│   └── ios-release.sh        # build + App Store
├── fastlane/
│   ├── Fastfile              # the upload_beta and upload_release lanes
│   ├── Appfile               # app_identifier, apple_id, team_id
│   └── AuthKey_VL6TWU5ST5.p8 # App Store Connect API key
├── certs/
│   ├── dist.p12              # distribution certificate
│   └── dist.mobileprovision  # provisioning profile
├── credentials.json          # EAS local credentials config
├── Gemfile                   # Fastlane dependencies
└── eas.json                  # EAS Build profiles
```

> [!NOTE]
> Running on a simulator during development has nothing to do with this pipeline:
> `cd apps/mobile && npx expo run:ios`.

## Prerequisites

### Credentials

| Item | Value |
| --- | --- |
| Bundle ID | `com.example.skkumap` |
| Apple ID | `spencer0124@naver.com` |
| Team ID | `95HGXTX76L` |
| API key ID | `VL6TWU5ST5` |
| API issuer ID | `97e30026-b115-4ce3-8939-a98af36dcf3b` |
| EAS project ID | `43e326a2-2f25-4317-a341-a107a52c5405` |

- `credentials.json` has to point at the local certificate (`certs/dist.p12`) and the
  provisioning profile (`certs/dist.mobileprovision`).
- Fastlane authenticates for upload with the App Store Connect API key,
  `fastlane/AuthKey_VL6TWU5ST5.p8`.

### .easignore

When EAS archives the project it applies `.easignore` in place of `.gitignore`. Keep the two
the same, except that these files have to reach the build:

| File | .gitignore | .easignore | Why |
| --- | :---: | :---: | --- |
| `GoogleService-Info.plist` | excluded | **included** | iOS Firebase config |
| `google-services.json` | excluded | **included** | Android Firebase config |
| `.env` | excluded | **included** | The `EXPO_PUBLIC_*` variables |

### Two settings the monorepo needs for a local EAS build

Without both, the embed bundle step fails with `ARCHIVE FAILED`. The mechanism is in the
troubleshooting section below.

1. `EXPO_NO_METRO_WORKSPACE_ROOT=1` in the beta and production profile env in `eas.json`.
2. `export TMPDIR="$HOME/.eas-build-tmp"`, a path with no symlink in it, in the build scripts
   `scripts/ios-{beta,build,release}.sh`.

### Versioning happens by itself

- `eas.json` sets `appVersionSource: "remote"`, so EAS keeps the build number.
- `autoIncrement: true` is on for both the beta and production profiles, and it does work
  under `--local`.
- Each build increments the current number by one before building, so there is nothing to
  maintain by hand.
- `buildNumber` in `app.config.ts` is ignored, surviving only in the expo-constants manifest.
- To read the current number:

  ```bash
  eas build:version:get -p ios --non-interactive --json
  ```

## Steps

1. **Update the release notes.** These are the changes shown on the App Store and in
   TestFlight. Edit the per-locale files under `fastlane/metadata/ios/` and they are included
   automatically at upload. Leaving them alone re-uploads whatever is there. The limit is
   4000 characters.

   ```text
   fastlane/metadata/ios/
   ├── ko/release_notes.txt        ← Korean
   ├── en-US/release_notes.txt     ← English
   └── zh-Hans/release_notes.txt   ← Simplified Chinese
   ```

   - `upload_release` sends all three languages to the App Store, through the
     `release_notes` hash parameter.
   - `upload_beta` shows the Korean one alone in TestFlight's "what to test", through the
     `changelog` parameter.

2. **Run the build and upload script**

   ```bash
   cd apps/mobile

   ./scripts/ios-build.sh     # build the .ipa only
   ./scripts/ios-beta.sh      # build and upload to TestFlight
   ./scripts/ios-release.sh   # build and upload to the App Store
   ```

   Each script runs in two stages.

   **Stage 1, EAS Build (`--local`):**

   ```bash
   eas build --platform ios --profile production --local --non-interactive --output ./build.ipa
   ```

   - Compresses the project into a `.tar.gz` and builds it in a temporary directory.
   - Applies `.easignore` in place of `.gitignore`.
   - Uses the local certificate and profile from `credentials.json`.
   - Produces `build.ipa`.

   **Stage 2, the Fastlane upload:**

   ```bash
   bundle exec fastlane ios upload_beta ipa:"./build.ipa"      # TestFlight
   bundle exec fastlane ios upload_release ipa:"./build.ipa"   # App Store
   ```

   - Authenticates with the App Store Connect API key, `AuthKey_VL6TWU5ST5.p8`.
   - `upload_to_testflight` uploads to TestFlight and skips waiting for processing.
   - `deliver` uploads to the App Store with automatic submission and release off,
     `ignore_language_directory_validation: true`, and
     `precheck_include_in_app_purchases: false`.

## Troubleshooting

### CocoaPods not found, when eas build is called from Fastlane

Calling eas build inside Fastlane's Ruby environment produces a CocoaPods PATH problem. That
is why the build (a shell script) and the upload (Fastlane) are separate.

### GoogleService-Info.plist not found, during EAS Build

This happens when `.easignore` is missing or excludes that file. Check that the Firebase files
are commented out, and therefore included, in `.easignore`.

### The Naver Map key is empty

If `.easignore` excludes `.env`, then `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` becomes an empty
string. Check that `.env` is included.

### The build aborts on EXPO_PUBLIC_BASE_URL

`app.config.ts` guards that variable and throws rather than producing a config. It fails when
the value is missing, empty or whitespace-only, and separately when it names a local host —
`localhost`, `127.0.0.1`, `10.0.2.2`, or any `http://` scheme — while `EAS_BUILD_PROFILE` is
`beta` or `production`. That second rule is the one that fires after a local API test: `.easignore`
ships `.env` into the EAS sandbox and `eas.json` overrides the variable in no profile, so whatever
`.env` last said is exactly what would have shipped. Point `apps/mobile/.env` back at the deployed
API host. Local development is exempt from the localhost rule, so `expo run:ios` is unaffected.

### ARCHIVE FAILED with "Unable to resolve module .../apps/mobile/index.ts"

**The symptom.** Native compilation and linking all pass, and then Xcode's "Bundle React
Native code and images" script phase reports
`Unable to resolve module .../apps/mobile/index.ts from .../build/.` followed by
`** ARCHIVE FAILED **`.

**There are two independent causes and both have to be fixed.** Fixing one alone only moves
the error.

1. **@expo/cli's Metro workspace-root default.** A recent @expo/cli made
   `EXPO_USE_METRO_WORKSPACE_ROOT` **default to on**, in
   `@expo/config/build/paths/env.js`. In the EAS sandbox, `yarn --frozen-lockfile` creates a
   nested `apps/mobile/node_modules`, which a fully hoisted local repo does not have, and that
   triggers workspace-root detection. Metro's server root becomes the monorepo root,
   `build/`, so it can find neither the entry nor the `tsconfig.json` paths such as
   `@/* → ./src/*`. The fix is **`EXPO_NO_METRO_WORKSPACE_ROOT=1` in the `eas.json` build
   env**. Setting `EXPO_USE_...=1` is a no-op, since it is already on. Once the server root
   moves from `build/` to `build/apps/mobile`, this step passes.

2. **A macOS symlink mismatch.** After fixing the first cause, the entry path is the symlinked
   form (`/tmp/...`) while Metro's server root is the realpath (`/private/tmp/...`), so Metro
   sees one directory under two names and fails to match. Both `/tmp` and `/var/folders` are
   symlinks, so this happens in an ordinary terminal too. The fix is for **the build script to
   `export TMPDIR="$HOME/.eas-build-tmp"`** and build somewhere with no symlink, which
   `scripts/ios-{beta,build,release}.sh` already do.

**A debugging note.** This failure **does not reproduce in the local repo**, which is fully
hoisted. Do not guess and re-run a twelve-minute full build. Go into the EAS sandbox while a
build is still alive, at `$TMPDIR/eas-build-local-nodejs/*/build/apps/mobile`, and run
`expo export:embed` there directly. With the CWD and projectRoot at apps/mobile it resolves
5825 modules; at the monorepo root it breaks.

## Related

- [android-build-deploy.md](../how-to/android-build-deploy.md) — the Android half of the same
  pipeline
- [ota-update.md](../how-to/ota-update.md) — publishing an OTA, which follows the same beta
  and production channels
- [docs/README.md](../README.md) — the writing rules
