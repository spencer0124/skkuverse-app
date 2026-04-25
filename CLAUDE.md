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
npx expo prebuild --clean  # 네이티브 변경 후 clean prebuild

# Webview
cd apps/webview
yarn dev              # Vite dev server
yarn build            # tsc + vite build

# Root
yarn lint             # ESLint across the monorepo
yarn test:rules       # Firestore rules tests (Firestore emulator + node:test)
                      # 내부적으로 openjdk@25로 JAVA_HOME override.
                      # 배포 전 반드시 green 확인.
```

Firestore rules는 `apps/mobile/firestore.rules`에 정의. 배포 명령:
```bash
firebase deploy --only firestore:rules
```

Node version is pinned to **20** (see `.nvmrc`).

## Architecture

### Mobile App (`apps/mobile/`)

**Routing:** Expo Router (file-based). Route files live in `app/`, feature code in `src/features/`.

**Provider stack** (defined in `app/_layout.tsx`):
```
ErrorBoundary → GestureHandlerRootView → SDSProvider → QueryProvider → InitGate → Stack
```

**Feature modules** (`src/features/`): `home`, `bus`, `map`, `building`, `search`, `notices` — each self-contained with components, hooks, and utils.

**Server-Driven UI (SDUI):** The home screen fetches section configs from the backend and renders them via widget components in `src/sdui/widgets/`.

**Path aliases** (tsconfig): `@/*` → `./src/*`, `@skkuverse/*` → `../../packages/*/src`.

### Data Layer (in `@skkuverse/shared`)

- **API client:** Axios with auth interceptor and retry. Requests wrapped in `Result<T>` (success/failure union).
- **Stores:** `useAuthStore` (Firebase auth), `useSettingsStore` (campus, language, lastTab), `useMapLayerStore`.
- **React Query hooks:** `useCampusSections`, `useTransitList`, `useBusConfig`, `useMapConfig`, `useBuildings`, etc.
- **i18n:** `useT()` hook, `SUPPORTED_LANGUAGES`.

### Webview App (`apps/webview/`)

Hash-based routing (React Router). Communicates with the native app via `@skkuverse/bridge`. Styled with Tailwind CSS (custom color `deep-green: #1A8A5C`, font `WantedSans`).

Pages: `hsscmap/`, `nscmap/` (Naver Maps), `bus/`, `lostandfound/`, `error`.

### Notices Feature (`src/features/notices/`)

**Tab layout:** Server-driven via `GET /notices/tabs`. 서버가 탭 종류, 순서, 타입(`fixed`/`picker`), picker 학과 목록, `maxSelection`, `defaultDeptIds`를 모두 내려줌. 현재 9탭: 학과 / 학사 / 장학 / 취업 / 모집 / 행사 / 도서관 / 기숙사 / 일반. `tabMode: "picker"` 탭은 multi-dept picker (BottomSheetModal, multi-select).

**Markdown rendering:** `react-native-marked` (major in `apps/mobile/package.json`), custom `NoticeRenderer` extending `Renderer`:
- `image()`: `RefererImage` component — SKKU 이미지 서버의 Referer 요구사항 대응 + dimension hint 기반 shimmer placeholder
- `paragraph()`: 이미지 포함 paragraph → `<View>`, 텍스트만 → `<Text selectable>` 분기 (Animated.View가 Text 안에서 동작하지 않는 RN 제약 우회)
- `link()`: 웹 링크 → in-app browser, 이메일/전화 → 클립보드 복사

**Image dimension hint (크롤러 연동):** 크롤러가 `![{WxH} alt](url)` 포맷으로 이미지 원본 크기를 markdown alt text에 삽입. 앱의 `parseDimHint()`가 이를 파싱하여 이미지 로딩 전 정확한 크기의 shimmer skeleton을 overlay로 표시 → CLS(Cumulative Layout Shift) 제거. hint가 없는 이미지는 `getSizeWithHeaders` 완료 후 표시.

**Notice row:** Toss-style 왼쪽 정렬 메타 (`3일 전 · 학과명` — multi-dept 탭에서만 학과명 표시). 첨부파일 있는 공지는 제목 옆 paperclip 아이콘. 마감일 있는 공지는 deadline badge 표시 (D-day 기반 색상 시스템).

**Login gate:** 공지사항 등 인증 필요 기능은 `NoticeLoginGate`로 Google 로그인 유도. `@g.skku.edu` 도메인 필수.

**첨부파일:** `files.skkuverse.com` 프록시 경유. preview/download 버튼 제공.

### Design System (`@skkuverse/sds`)

Provides themed components via `SDSProvider`. Design tokens (colors, typography, spacing, radius, shadows) are centralized in `@skkuverse/shared/tokens/`.

## Deep Link

커스텀 스킴 `skkuverse://`와 유니버셜 링크 `https://skkuverse.com/p/...`로 외부에서 앱 진입 가능. `app/+native-intent.tsx`에서 화이트리스트 기반 필터링 (둘 다 동일 로직).

- **유니버셜 링크 prefix:** `/p/` (예: `skkuverse.com/p/search`) — 앱에서 자동 스트립
- **허용:** `/`, `/campus`, `/transit`, `/map/hssc`, `/search`
- **차단:** `/webview`, `/bus/*`, `/sds-preview` 등 나머지 전부 → 홈으로 리다이렉트
- **앱 내부 네비게이션(`router.push`)은 영향 없음**
- 자세한 내용은 `docs/deep-link.md` 참조

## Key Technical Details

- **Maps:** Naver Maps SDK via `@mj-studio/react-native-naver-map`. Android custom view markers require `renderToHardwareTextureAndroid` + `collapsable={false}` to avoid bitmap snapshot race condition (see `docs/android-naver-map-markers.md`)
- **Auth/Analytics:** Firebase (auth, analytics, crashlytics, app-check). Google Sign-In (`@g.skku.edu` 도메인 제한). App Check은 iOS App Attest + Android Play Integrity.
- **Push notifications:** FCM via `@react-native-firebase/messaging` + `@notifee/react-native`. Phase 1~4 (토큰·딥링크·뱃지·delivery CF) + **Phase 5 SSOT (2026-04-25)** 완료. 옵션 D — 알림함 없음, 뱃지는 Zustand+Notifee 로컬. 자세한 내용은 `docs/plans/fcm-push-notifications.md`. 임시 진단 화면 `app/debug-fcm.tsx` — 캠퍼스 탭 우상단 빨간 "FCM" 버튼으로 진입 (dogfooding 안정 후 제거).
- **FCM v5 SSOT (Firestore-driven, server-derived, 2026-04-25):** "기록은 의도, 전송은 파생" 원칙. 클라는 intent 4 필드만 씀 (`enabled`, `categoryEnabled: { essential, services, notices }`, `noticeTabEnabled: Record<string, boolean>`, `pickerSelections: Record<string, string[]>`). CF `onPreferencesWrite` 트리거(asia-northeast3, 2nd gen, Node 22)가 derive해서 `subscribedTopics` + `derivedAt` 채움. Firestore Rules가 derived 필드 client write 봉쇄. 클라 write API: `setMasterEnabled` / `setCategoryEnabled` / `setNoticeTabEnabled` / `setPickerSelectionRemote` (전부 단일 dot-path `updateDoc`, 트랜잭션 없음 — 캠퍼스 wifi dead spot offline 큐잉 보호). MMKV는 device-local state(token/deviceId/unreadCount)만 persist, `preferences`는 Firestore listener가 단일 source. Trigger guards 두 겹 (intent unchanged → skip self-loop, derived equal → skip idempotent write). 구현: `functions/src/notifications/{tabsContract,derive}.ts` + `functions/src/triggers/onPreferencesWrite.ts` + `apps/mobile/src/services/firestore-notifications.ts` + `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx`. 통합 검증: `cd functions && npm run verify:trigger` (firebase emulators:exec 4 시나리오). Rules 테스트: `yarn test:rules` (26 케이스, 13 devices + 13 preferences).
- **FCM tabsContract — 9 server tab key 미러:** `functions/src/notifications/tabsContract.ts`에 fixed 5개(`academic`/`scholarship`/`career`/`recruitment`/`event`)와 picker 4개(`dept`/`library`/`dorm`/`general`) 하드코딩. Source of truth: `~/project/skkuverse/skkuverse-server/features/notices/categories.json` (별도 레포). 백엔드가 새 탭 추가 시 같은 release에서 미러 갱신 필수. derive는 unknown picker key를 `logger.warn`하지만 unknown fixed key는 자체 감지 불가 (개발자 조율). 컨벤션: picker tab key === topic prefix (identity 매핑) — `pickerPrefixForTabKey` 함수 폐기됨.
- **FCM preferences ↔ devices drift (2026-04-23 해결):** Cloud Function `syncPreferencesToDevices` (2nd gen, `asia-northeast3`, Node 22). `users/{uid}/preferences/main` onWrite trigger → 해당 uid 의 active devices 모두에 `subscribedTopics` + `notificationsEnabled` **두 필드만** whitelist update. 실측 latency ~0.3초. 구현: `functions/src/sync-preferences-to-devices.ts`. 설정: `retry: true` + 10분 event age guard + `maxInstances: 10` + before/after diff Set 비교 + admin SDK (rules 우회). 운영 주의사항은 `docs/plans/fcm-push-notifications.md` Phase 3 디버깅 기록 #2 섹션 참조.
- **FCM delivery path (Phase 4, 2026-04-23 배포 완료):** `sendNotification` HTTP CF (2nd gen, asia-northeast3, Node 22) + `handleNoticeNotification` internal handler. Endpoint: `https://asia-northeast3-skkubus-95723.cloudfunctions.net/sendNotification`. 인증: `X-API-Key` 헤더 vs Secret Manager `FCM_API_KEY` — `defineSecret` 바인딩 + `timingSafeEqual` + **`.trim()` 방어**. devices 쿼리는 composite index 필수 — `apps/mobile/firestore.indexes.json` (active + notificationsEnabled + subscribedTopics). **Critical cleanup 정책: `TOKEN_CLEANUP_CODES` allowlist 에 `registration-token-not-registered` + `invalid-registration-token` 두 개만 포함** — `messaging/invalid-argument` 의도적 제외 (payload-wide 에러라 healthy device 500개를 `active:false`로 꺼버리는 footgun). FCM `data` payload는 `Record<string, string>` 빌드 (optional undefined 제외, v1 API validation 보호). 구조화 로깅: `logger.info('notice.dispatch.complete', { noticeId, topics, deviceCount, sent, failed, cleanedUp, durationMs })` → Cloud Logging `jsonPayload.noticeId="..."` 필터. 구현: `functions/src/{send-notification,handle-notice,channels,types}.ts`. 백엔드 payload 계약 (`NoticeNotificationPayload`) 별도 레포 공유.
- **Firestore 디버깅 기법 (2026-04-23 확립):** (1) `onSnapshot` 에 `{ includeMetadataChanges: true }` 없이는 서버 ack / fromCache 전환이 emit 되지 않아 "write 미도달" 오진 유발. (2) Firebase Console은 자체 listener라 stale 뷰 보일 수 있음 → server truth는 Firestore REST API로 직접 조회 (`~/.config/configstore/firebase-tools.json`의 refresh_token 활용). (3) 복제 필드 drift는 두 replica의 `updateTime` 비교로 first-step 판정.
- **FCM auth transition (Task #12 + 2026-04-25 보강):** anon↔Google uid 전환 시 `devices/{deviceId}.uid` stale → `firestore/permission-denied` 버그 해결. `useAppInit`의 `onAuthStateChanged`가 `authStore.lastKnownUid`로 uid 전환 감지하여 `initializeFirestoreNotifications()` 재실행 (`withRetry` closure는 `getAuth().currentUser?.uid` lazy resolve — race-safe). `signOutFromGoogle`은 sign-out 전에 `unregisterDevice(deviceId)`로 active:false 처리. **2026-04-25 보강 — anon→Google 미러**: `OnboardingScreen.handleSignIn` + `app/login.tsx`의 `handleSignIn` 양쪽에 sign-in 전 `unregisterDevice` + sign-in 후 `await initializeFirestoreNotifications` 패턴 추가 (rule path b 통과 + step 5 race 차단). Firestore rule: "active 문서는 owner만, inactive 문서는 아무 authed user가 claim 가능" 시맨틱 — `firestore.rules` SECURITY TRADE 주석 + `firestore.rules.test.mjs` 26 케이스 (devices 13 + preferences 13) 참조. Rules는 `skkubus-95723` production 배포 완료.
- **App Check debug token (iOS Simulator):** `.env`의 `FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS` → `app.config.ts` `extra` → `src/services/app-check.ts` 에서 `provider.configure({ apple: { debugToken } })` 로 전달. RN Firebase가 내부적으로 `setenv("FIRAAppCheckDebugToken", value)` 호출해서 AppCheckCore가 env 경로로 읽음. **UserDefaults (`GACAppCheckDebugToken`) fallback은 iOS Simulator + 이 Expo prebuild 조합에서 silently 무시됨** — 2026-04-22 재현·확정. `EAS_BUILD_PROFILE=beta|production` 이면 `app.config.ts extras` 에서 debug token 자동 strip → 퍼블릭 레포 + 프로덕션 번들 안전. 시뮬레이터 켤 때 디버그 토큰 교환 안 되면 Firebase Console → App Check → iOS 앱 → Manage debug tokens 에 `.env` 값과 정확히 같은 UUID 등록 여부 먼저 확인.
- **Data storage 원칙:** 유저 데이터는 모두 **Firebase** (Firestore/Auth), 공공 데이터(공지사항, 건물정보, 버스 등)는 **MongoDB** (백엔드 API 경유)
- **Local storage:** `react-native-mmkv` for general state, `expo-secure-store` for sensitive data
- **Animations:** React Native Reanimated 4 + Gesture Handler 2
- **Bottom sheets:** `@gorhom/bottom-sheet`
- **Icons:** `lucide-react-native`
- **TypeScript strict mode** enabled across the monorepo
- **iOS bundle ID:** `com.example.skkumap` / **Android package:** `com.zoyoong.skkubus`
- **개발 실행:** Expo Go 사용하지 않음. **CNG (Continuous Native Generation)** 방식으로 `yarn ios` (`expo run:ios`) / `yarn android` (`expo run:android`)로 네이티브 빌드 직접 실행. 커스텀 네이티브 모듈(Firebase, Naver Maps 등) 사용을 위해 항상 네이티브 빌드 필요.
- **네이티브 변경 후 실행:** 네이티브 코드에 영향을 주는 변경(패키지 추가/삭제, `app.config.ts` plugins 변경, 네이티브 모듈 설정 등) 후에는 반드시 `npx expo prebuild --clean` 후 `yarn ios` / `yarn android`로 실행
- **EAS Build:** Configured in `apps/mobile/eas.json` (dev/preview/production profiles)
- **Naver Map patch:** `patches/@mj-studio+react-native-naver-map+2.7.0.patch` (nil iconImage crash fix)
- **Android dev environment:** CLI-only SDK (no Android Studio IDE), JDK 17, `ANDROID_HOME=~/Library/Android/sdk`

## Build & Deploy (로컬 빌드)

이 프로젝트는 **EAS Build `--local`** + **Fastlane**으로 로컬에서 빌드/배포함. EAS 클라우드 빌드 안 씀. 자세한 내용은 `docs/ios-build-deploy.md`, `docs/android-build-deploy.md` 참조.

```bash
cd apps/mobile

# iOS
./scripts/ios-build.sh         # .ipa 빌드만
./scripts/ios-beta.sh          # 빌드 + TestFlight
./scripts/ios-release.sh       # 빌드 + App Store

# Android
./scripts/android-build.sh     # .aab 빌드만
./scripts/android-beta.sh      # 빌드 + Google Play internal testing
./scripts/android-release.sh   # 빌드 + Google Play production (draft)
```

**공통 주의사항:**
- `credentials.json`에 iOS(dist.p12 + mobileprovision)와 Android(upload-keystore.jks) 인증 설정
- `eas.json`의 `production` 프로필에 `"credentialsSource": "local"` 필수
- `.easignore`가 `.gitignore` 대신 적용됨 — Firebase 설정, `.env`, `certs/certificate.pem`이 빌드에 포함되어야 함
- `autoIncrement: true`가 beta/production 프로필 모두에 설정됨 — `--local` 빌드에서도 동작. EAS remote version은 플랫폼별 독립 관리. `app.config.ts`의 `buildNumber`는 무시됨 (expo-constants manifest에만 남음)
- `expo-channel-name`은 EAS 클라우드에서만 자동 주입됨 → **로컬 빌드에서는 `app.config.ts`의 `updates.requestHeaders`에 수동 설정 필수**
- Android 빌드 스크립트에 `JAVA_HOME`(JDK 17), `ANDROID_HOME` 자동 설정 포함
- iOS bundle ID: `com.example.skkumap` / Android package: `com.zoyoong.skkubus`
- **Release Notes**: 배포 전에 `fastlane/metadata/` 아래 locale별 파일 수정 → 업로드 시 자동 포함
  - Android: `metadata/android/{ko-KR,en-US,zh-CN}/changelogs/default.txt` (최대 500자)
  - iOS: `metadata/ios/{ko,en-US,zh-Hans}/release_notes.txt` (최대 4000자)

## OTA 업데이트

셀프호스팅 expo-open-ota 서버 (`https://ota.skkuverse.com`). 자세한 내용은 `docs/ota-update.md` 참조.

```bash
cd apps/mobile

# beta (TestFlight/Internal Testing 사용자에게만)
./scripts/ota-beta.sh

# production (App Store/Play Store 사용자에게만)
./scripts/ota-release.sh
```

- **채널 분리:** beta 스크립트(`*-beta.sh`)로 빌드 → "beta" 채널, release 스크립트(`*-release.sh`)로 빌드 → "production" 채널. `app.config.ts`에서 `EAS_BUILD_PROFILE` 환경변수로 채널 자동 결정
- **runtimeVersion:** 고정 문자열 (실제 값은 `apps/mobile/app.config.ts`에서 확인). 네이티브 코드 변경 시에만 수동으로 올려야 함. fingerprint 방식은 EAS build와 eoas 간 불일치 이슈로 사용하지 않음
- **EXPO_TOKEN:** `.env.ota.local`에 저장 (gitignored). OTA 스크립트가 자동으로 읽음
- **권장 워크플로우:** beta에 먼저 OTA → 검증 → production에 OTA
- **OTA로 배포 가능:** UI 변경, 비즈니스 로직, 에셋 추가 등 JS-only 변경
- **네이티브 리빌드 필요:** 새 네이티브 모듈, SDK 업그레이드, app.config.ts plugins 변경 → `runtimeVersion` bump 필수
