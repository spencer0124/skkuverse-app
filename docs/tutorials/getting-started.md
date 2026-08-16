---
title: Getting Started
type: tutorial
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
audience: internal
---

# Getting Started

> A guided walk from cloning on a new machine to seeing the app running in a simulator or emulator, written for someone joining for the first time.

> [!NOTE]
> The goal here is "follow along and the app runs". Why each step is the way it is belongs to
> [explanation/architecture.md](../explanation/architecture.md), and the build and release
> procedures live in the [how-to/](../how-to/) runbooks.

## What you need

Have these in place before starting.

| Tool | Version or setting | How to check |
| --- | --- | --- |
| Node.js | Whatever `.nvmrc` pins. One `nvm use` matches it | `node -v` |
| Yarn | 1.x classic, which manages the workspaces | `yarn -v` |
| Xcode | For iOS builds. Install from the App Store, plus the Command Line Tools | `xcodebuild -version` |
| JDK | 17, for Android builds | `java -version` |
| Android SDK | CLI-only install with `ANDROID_HOME=~/Library/Android/sdk`. The Android Studio IDE is not used | `echo $ANDROID_HOME` |

> [!WARNING]
> **Expo Go is not used here.** This app depends on custom native modules such as Firebase
> and Naver Maps, so it always runs a real native build through CNG (Continuous Native
> Generation). Scanning a QR code in Expo Go will not work.

## 1. Clone and install

Clone the repo and install **from the root**. It is a Yarn workspaces monorepo, so one
install at the root covers `apps/*` and `packages/*`.

```bash
git clone <repo-url> skkuverse-app
cd skkuverse-app
nvm use          # switch to the .nvmrc version
yarn install
```

At the end of the install, `postinstall` runs `patch-package`, which applies the library
patches under `patches/`. Check that those log lines went by without an error: an unapplied
patch shows up later as a runtime crash, in the map markers among other places.

## 2. Put the secret files in place

Some files are never committed. Get them from an existing machine and drop them where they
belong.

1. **`apps/mobile/.env`**. Copy `apps/mobile/.env.example`, which is the schema and explains
   each key. There is less in it than you might expect: the API host, the Naver Maps client ID
   and the Google OAuth web client ID are committed constants in `apps/mobile/config/constants.js`,
   so what remains is the App Check debug tokens plus two optional switches.
2. **The Firebase config files**: `apps/mobile/google-services.json` for Android and
   `apps/mobile/GoogleService-Info.plist` for iOS. Download them from the Firebase console or
   get them separately.
3. **An App Check debug token for the iOS simulator.** A simulator cannot use App Attest, so
   `FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS` in `.env` is required, and the same UUID has to be
   registered under Firebase console, App Check, the iOS app, Manage debug tokens. Without
   that match the token exchange fails.

## 3. First run on iOS

Now start the app, from `apps/mobile`.

```bash
cd apps/mobile
yarn ios
```

`yarn ios` type-checks first with `tsc --noEmit`, then runs `expo run:ios`, which builds
natively, installs to the simulator, and connects the Metro bundler. The first build takes a
while, between the CocoaPods install and the native compile.

When the app appears in the simulator showing the home tab, it worked.

## 4. Run on Android

Android is one line from the same place.

```bash
cd apps/mobile
yarn android
```

An emulator has to be running, or a real device connected. Check first that `JAVA_HOME`
points at JDK 17 and that `ANDROID_HOME` is set.

## 5. When you need `prebuild --clean`

Everyday JS edits hot-reload through Metro. A change that touches **native** needs the native
project regenerated.

```bash
cd apps/mobile
npx expo prebuild --clean
yarn ios   # or yarn android
```

You need it after adding or removing a package, changing plugins in `app.config.ts`, or
changing a native module's configuration. When the build succeeds but a new native feature
does nothing, this step is usually what was skipped.

## Next steps

With the app running, start reading the codebase.

- [explanation/architecture.md](../explanation/architecture.md) — monorepo boundaries, data
  flow, the provider stack
- [how-to/ios-build-deploy.md](../how-to/ios-build-deploy.md) and
  [how-to/android-build-deploy.md](../how-to/android-build-deploy.md) — the release runbooks
- [how-to/ota-update.md](../how-to/ota-update.md) — publishing a JS-only change over OTA
- The root `CLAUDE.md`, which is the current SSOT for architecture, patterns and gotchas

## Related

- [docs/README.md](../README.md) — the docs index and writing rules
- [explanation/ios-modal-safe-area-provider.md](../explanation/ios-modal-safe-area-provider.md)
  — a modal safe-area constraint worth knowing before doing screen work
