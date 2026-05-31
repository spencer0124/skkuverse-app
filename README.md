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
- **skkuverse-crawler** (Python) — crawls 147 SKKU department notice sources, triggers FCM dispatch
- **skkuverse-ai** (FastAPI) — generates AI summaries for crawled notices
- **skkuverse-codepush** (Expo EAS, `ota.skkuverse.com`) — OTA update server for this app

What the app delivers to students:

- **Real-time shuttle positions** — HSSC campus shuttle + 종로02/07 city bus (live polling)
- **Campus shuttle schedules** — Inja–Jain intercampus, no-service on holidays and SKKU rest days
- **Bus stop ETAs** — 혜화역 arrival info
- **Department notices** — 147-source feed with AI summaries, per-source subscriptions, FCM push
- **Building & space search** — SKKU campus map with room-level detail
- **Server-driven UI** — home screen sections and map config served dynamically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo 54 |
| Language | TypeScript ~5.9 |
| Routing | Expo Router v4 (file-based) |
| State | Zustand v5 |
| Data fetching | TanStack React Query v5 |
| Auth | Firebase Auth + Google Sign-In |
| Database | Firebase Firestore (direct client) |
| Push notifications | Firebase Cloud Messaging (FCM v1) |
| Crash reporting | Firebase Crashlytics |
| Maps | Naver Maps |
| OTA updates | EAS Update (`ota.skkuverse.com`) |
| Build / distribution | EAS Build |
| Cloud Functions | Firebase Functions (Node.js) |

---

## Project Structure

```
skkuverse-app/
├── apps/
│   ├── mobile/                    # React Native + Expo app
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
│   └── webview/                   # Embedded web view (in-app browser)
├── packages/                      # Shared monorepo packages
├── functions/                     # Firebase Cloud Functions
│   └── src/                       # dispatchNotice, sync-preferences, triggers
├── docs/                          # Architecture decisions
├── firebase.json                  # Firebase project config
├── eas.json                       # EAS Build + Update config
└── package.json                   # Yarn workspace root
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 22 (`.nvmrc`; run `nvm use` to align)
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

The app reads environment variables from `.env` at `apps/mobile/`. Copy `.env.example` and fill in:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.skkuverse.com
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=...
```

Firebase config is bundled via `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) — not committed, provisioned separately per EAS environment.

---

## Build & Distribution

Managed via [EAS Build](https://docs.expo.dev/build/introduction/). Config in `apps/mobile/eas.json`.

```bash
# Production build (iOS)
eas build --platform ios --profile production

# OTA update (no app store review)
eas update --branch production --message "..."
```

OTA updates are served from `ota.skkuverse.com` (skkuverse-codepush).

---

## Cloud Functions

Firebase Cloud Functions under `functions/src/` handle server-side logic that can't live in the mobile client:

| Function | Trigger | Description |
|---|---|---|
| `dispatchNotice` | HTTP (called by skkuverse-server) | Reads FCM tokens from Firestore, sends FCM v1 push |
| `sync-preferences-to-devices` | Firestore trigger | Propagates subscription changes to device token docs |
| `handle-notice` | Firestore trigger | Post-processing on new notice documents |
| `delete-account` | Callable | Full account + data deletion |

---

## Further Reading

- **`CLAUDE.md`** — guidance for Claude Code (architecture, patterns, ecosystem boundaries)
- **`docs/`** — architecture decisions and runbooks
- **`apps/mobile/firestore.rules`** — Firestore security rules with inline test coverage

---

## License

[Apache License 2.0](LICENSE) — Copyright 2024-2026 spencer0124
