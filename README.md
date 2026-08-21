# skkuverse-app

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth_%2B_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)

> React Native campus companion powering **[skkuverse](https://skkuverse.com)** — real-time shuttle tracking, AI-summarized department notices across 147 sources, and building search for Sungkyunkwan University students.

---

## Ecosystem

This app is the primary client in the skkuverse ecosystem. It reads live data from **skkuverse-server** over HTTPS using a Firebase `Bearer <idToken>`, and manages user state directly via Firebase Firestore. Sibling services:

- **skkuverse-server** (NestJS + MongoDB) — REST API for bus, notices, building, map, and UI data
- **skkuverse-web** (React + Vite, `webview.skkuverse.com`) — every browser surface: the pages this app loads in a web view, and the admin console
- **skkuverse-crawler** (Python) — crawls 147 SKKU department notice sources, triggers FCM dispatch
- **skkuverse-ai** (FastAPI) — generates AI summaries for crawled notices
- **skkuverse-codepush** (Expo EAS, `ota.skkuverse.com`) — OTA update server for this app

What the app delivers to students:

- **Real-time shuttle positions** — HSSC campus shuttle plus the Jongno 02 and 07 city buses, polled live
- **Campus shuttle schedules** — Inja–Jain intercampus, no-service on holidays and SKKU rest days
- **Bus stop ETAs** — arrival times at Hyehwa Station
- **Department notices** — 147-source feed with AI summaries, per-source subscriptions, FCM push
- **Building & space search** — SKKU campus map with room-level detail
- **Server-driven UI** — home screen sections and map config decided by the server

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React Native 0.81 + Expo 54 |
| Language | TypeScript ~5.9 |
| Routing | Expo Router (file-based; version in `apps/mobile/package.json`) |
| State | Zustand v5 |
| Data fetching | TanStack React Query v5 |
| Auth | Firebase Auth + Google Sign-In |
| Database | Firebase Firestore (direct client) |
| Push notifications | Firebase Cloud Messaging (FCM v1) |
| Crash reporting | Firebase Crashlytics |
| Maps | Naver Maps |
| OTA updates | Self-hosted expo-open-ota (`ota.skkuverse.com`) |
| Build / distribution | EAS Build `--local` + Fastlane |
| Cloud Functions | Firebase Functions (Node.js) |

---

## Project Structure

```text
skkuverse-app/
├── apps/
│   └── mobile/                    # React Native + Expo app
│   │   ├── app/                   # Expo Router file-based routing
│   │   │   ├── (tabs)/            # Bottom tab navigator
│   │   │   │   ├── home/          # Home screen (SDUI-driven)
│   │   │   │   ├── transit/       # Bus & shuttle screens
│   │   │   │   ├── notices/       # Department notice feed
│   │   │   │   └── campus/        # Campus map & building search
│   │   │   ├── bus/, map/, notices/, search/, settings/  # Stack screens
│   │   │   └── login.tsx, onboarding.tsx  # Auth flow
│   │   ├── app.config.ts          # Expo app config (EAS, plugins)
│   │   └── firestore.rules        # Firestore security rules + tests
├── packages/                      # Shared monorepo packages
├── functions/                     # Firebase Cloud Functions
│   └── src/                       # dispatchNotice, sync-preferences, triggers
├── docs/                          # Documentation (Diátaxis: how-to, reference, explanation, decisions)
├── firebase.json                  # Firebase project config
├── eas.json                       # EAS Build + Update config
└── package.json                   # Yarn workspace root
```

---

## Getting Started

### Prerequisites

- Node.js 20 (`.nvmrc`; run `nvm use` to align)
- Yarn (workspace manager)
- Expo CLI (`npx expo`)
- A physical device or simulator for running the app

### Install & Run

```bash
# Install all workspace dependencies
yarn install

# Start the Expo dev server
cd apps/mobile && npx expo start

# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android
```

### Environment

Most of what used to live in `.env` does not any more. The API host, the Naver Maps client ID and
the Google OAuth web client ID are committed constants in `apps/mobile/config/constants.js`, which
records per value why it is already public. They never differed between a laptop and a release, and
both eas-cli and eoas evaluate this project's config with `EXPO_NO_DOTENV=1`, so on a release path
no dotenv file is read at all — a value survived there only because somebody remembered a `source`
line in a shell script, and forgetting exactly that line is what shipped two OTA updates with no
API host.

What remains in `.env` at `apps/mobile/` is per-machine or genuinely secret: the App Check debug
tokens, plus two optional switches. **`apps/mobile/.env.example` is the schema** — copy it to
`.env` and fill it in. The file is gitignored, and `.easignore` excludes it from the EAS build
archive, so it never reaches an artifact.

`EXPO_PUBLIC_BASE_URL` is now a local override alone. `resolveBaseUrl()` in `app.config.ts` does
not read it at all when `EAS_BUILD_PROFILE` or `RELEASE_CHANNEL` names a shipping profile — a dev
host is unrepresentable in a release artifact rather than merely rejected. Unset means the
production host, and a `__DEV__` build talking to it shows a persistent on-screen strip so that is
never a surprise.

Firebase config is bundled via `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) — not committed, provisioned separately per EAS environment.

---

## Build & Distribution

Built locally with [EAS Build](https://docs.expo.dev/build/introduction/) `--local` + Fastlane upload (no EAS cloud builds). Config in `apps/mobile/eas.json`.

```bash
cd apps/mobile

# iOS:    build / build+TestFlight / build+App Store
./scripts/ios-build.sh && ./scripts/ios-beta.sh && ./scripts/ios-release.sh

# Android: build / internal testing / production
./scripts/android-build.sh && ./scripts/android-beta.sh && ./scripts/android-release.sh

# OTA (JS-only changes, no store review) — beta / production channels
./scripts/ota-beta.sh
./scripts/ota-release.sh
```

OTA updates are served from a self-hosted [expo-open-ota](https://github.com/axelmarciano/expo-open-ota) server at `ota.skkuverse.com`. See [docs/how-to/](docs/how-to/) for full runbooks.

---

## Cloud Functions

Firebase Cloud Functions under `functions/src/` handle server-side logic that can't live in the mobile client:

| Function | Trigger | Description |
| --- | --- | --- |
| `sendNotification` | HTTP (called by skkuverse-server) | Reads FCM tokens from Firestore, sends FCM v1 push |
| `syncPreferencesToDevices` | Firestore trigger | Propagates subscription changes to device token docs |
| `onPreferencesWrite` | Firestore trigger | Derives `subscribedTopics` from notification intent (SSOT) |
| `deleteAccount` | Callable | Full account + data deletion |

---

## Further Reading

- **[`docs/README.md`](docs/README.md)** — documentation index & writing conventions (start here)
- **[`docs/how-to/`](docs/how-to/)** — build, deploy, and OTA runbooks
- **[`docs/reference/`](docs/reference/)** — API contracts (map config, SDUI), deep-link spec, UX writing rules
- **[`docs/explanation/`](docs/explanation/)** — native platform deep-dives (iOS 26 tabs, safe area, map markers)
- **[`docs/decisions/`](docs/decisions/)** — architecture decision records
- **`CLAUDE.md`** — guidance for Claude Code (architecture, patterns, ecosystem boundaries)
- **`apps/mobile/firestore.rules`** — Firestore security rules with inline test coverage

---

## License

[Apache License 2.0](LICENSE) — Copyright 2024-2026 spencer0124
