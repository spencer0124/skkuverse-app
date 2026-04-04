# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skkuverse is a university campus app (SKKU) built as a **Yarn workspaces monorepo** with a React Native mobile app and a companion webview SPA.

## Monorepo Layout

- **`apps/mobile/`** — Expo 54 + React Native 0.81 mobile app (iOS/Android)
- **`apps/webview/`** — React 19 + Vite 6 SPA embedded as webviews in the mobile app
- **`packages/shared/`** — API client (Axios), Zustand stores, React Query hooks, types, design tokens, i18n
- **`packages/sds/`** — Skku Design System component library (37+ components)
- **`packages/bridge/`** — Web↔Native message-passing layer (`postToApp`, `parseWebMessage`)

## Common Commands

```bash
# Install dependencies (from root)
yarn install

# Mobile
cd apps/mobile
yarn start            # Expo dev server
yarn ios              # Type-check then run iOS
yarn android          # Type-check then run Android
yarn typecheck        # tsc --noEmit
yarn lint             # expo lint (ESLint)

# Webview
cd apps/webview
yarn dev              # Vite dev server
yarn build            # tsc + vite build

# Root lint
yarn lint             # ESLint across the monorepo
```

Node version is pinned to **20** (see `.nvmrc`).

## Architecture

### Mobile App (`apps/mobile/`)

**Routing:** Expo Router (file-based). Route files live in `app/`, feature code in `src/features/`.

**Provider stack** (defined in `app/_layout.tsx`):
```
ErrorBoundary → GestureHandlerRootView → SDSProvider → QueryProvider → InitGate → Stack
```

**Feature modules** (`src/features/`): `home`, `bus`, `map`, `building`, `search` — each self-contained with components, hooks, and utils.

**Server-Driven UI (SDUI):** The home screen fetches section configs from the backend and renders them via widget components in `src/sdui/widgets/`.

**Path aliases** (tsconfig): `@/*` → `./src/*`, `@skkuverse/*` → `../../packages/*/src`.

### Data Layer (in `@skkuverse/shared`)

- **API client:** Axios with auth interceptor and retry. Requests wrapped in `Result<T>` (success/failure union).
- **Stores:** `useAuthStore` (Firebase auth), `useSettingsStore` (campus, language), `useMapLayerStore`.
- **React Query hooks:** `useCampusSections`, `useTransitList`, `useBusConfig`, `useMapConfig`, `useBuildings`, etc.
- **i18n:** `useT()` hook, `SUPPORTED_LANGUAGES`.

### Webview App (`apps/webview/`)

Hash-based routing (React Router). Communicates with the native app via `@skkuverse/bridge`. Styled with Tailwind CSS (custom color `deep-green: #1A8A5C`, font `WantedSans`).

Pages: `hsscmap/`, `nscmap/` (Naver Maps), `bus/`, `lostandfound/`, `error`.

### Design System (`@skkuverse/sds`)

Provides themed components via `SDSProvider`. Design tokens (colors, typography, spacing, radius, shadows) are centralized in `@skkuverse/shared/tokens/`.

## Key Technical Details

- **Maps:** Naver Maps SDK via `@mj-studio/react-native-naver-map`
- **Auth/Analytics:** Firebase (auth, analytics, crashlytics)
- **Local storage:** `react-native-mmkv` for general state, `expo-secure-store` for sensitive data
- **Animations:** React Native Reanimated 4 + Gesture Handler 2
- **Bottom sheets:** `@gorhom/bottom-sheet`
- **Icons:** `lucide-react-native`
- **TypeScript strict mode** enabled across the monorepo
- **iOS bundle ID:** `com.example.skkumap`
- **EAS Build:** Configured in `apps/mobile/eas.json` (dev/preview/production profiles)
- **Naver Map patch:** `patches/@mj-studio+react-native-naver-map+2.7.0.patch` (nil iconImage crash fix)

## iOS Build (로컬 빌드)

이 프로젝트는 **EAS Build `--local`** + **Fastlane**으로 로컬에서 빌드/배포함. EAS 클라우드 빌드 안 씀.

```bash
cd apps/mobile
./scripts/ios-beta.sh      # 빌드 + TestFlight
./scripts/ios-release.sh   # 빌드 + App Store
```

**로컬 빌드 주의사항:**
- `credentials.json`이 `./certs/dist.p12` + `./certs/dist.mobileprovision` 경로를 참조
- `eas.json`의 `production` 프로필에 `"credentialsSource": "local"` 필수
- `.easignore`가 `.gitignore` 대신 적용됨 — Firebase 설정, `.env`, `certs/certificate.pem`이 빌드에 포함되어야 함
- `expo-channel-name`은 EAS 클라우드에서만 자동 주입됨 → **로컬 빌드에서는 `app.config.ts`의 `updates.requestHeaders`에 수동 설정 필수**

## OTA 업데이트

셀프호스팅 expo-open-ota 서버 (`https://ota.skkuverse.com`). 자세한 내용은 `docs/ota-update.md` 참조.

```bash
# OTA 발행 (JS 변경만, 네이티브 리빌드 불필요)
cd apps/mobile
EXPO_TOKEN=<토큰> RELEASE_CHANNEL=production npx eoas publish --branch production --nonInteractive --platform ios
```

**OTA로 배포 가능:** UI 변경, 비즈니스 로직, 에셋 추가 등 JS-only 변경
**네이티브 리빌드 필요:** 새 네이티브 모듈, SDK 업그레이드, app.config.ts plugins 변경
