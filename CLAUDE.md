# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

문서는 Diátaxis 구조 (`docs/how-to|reference|explanation|decisions|internal|plans`). **새 문서 작성·수정 전 `docs/README.md`(인덱스 + 작성 규칙 SSOT) 필독** — frontmatter 스키마, kebab-case, 값 복사 금지(버전·수치는 source-of-truth 파일 참조) 규칙. 마크다운 린트는 `yarn lint:md` (루트 `yarn lint`에 체인됨).

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
npx tsc --noEmit      # Type-check only (apps/mobile에는 별도 typecheck 스크립트 없음)
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

```text
ErrorBoundary → GestureHandlerRootView → SafeAreaProvider → SDSProvider → QueryProvider → InitGate → BottomSheetModalProvider → Stack
```

`SafeAreaProvider` is **explicit at root**(rnsac + Expo docs 권장 패턴) AND **also re-mounted inside each modal route** (e.g. `app/onboarding.tsx`). Modal routes registered with `presentation: 'fullScreenModal'` / `'modal'` mount in a separate native UIViewController; the root provider measures the wrong VC's insets, so the modal's first paint loses top safe area. Per-modal `<SafeAreaProvider>` wrap is mandatory for any modal screen — see `docs/explanation/ios-modal-safe-area-provider.md`.

**Tab structure (per-tab nested Stack):** `app/(tabs)/` 그룹 안에 4개 탭 디렉토리(`home/`, `campus/`, `transit/`, `notices/`)가 각자 `_layout.tsx`(`<Stack screenOptions={defaultHeaderOptions}/>`) + `index.tsx`(실제 화면)로 구성. 각 탭이 독립 Stack을 가지므로 탭 전환 시 부모 Stack의 `headerShown`이 토글되지 않음 — 콘텐츠가 위아래로 슬라이드하는 layout shift 방지. 헤더는 `react-native-screens` native-stack(iOS UINavigationController, Android Toolbar) 직접 사용 — 공통 옵션은 `apps/mobile/src/lib/header-options.ts`(`headerTitleAlign:'center'`, `headerBackButtonDisplayMode:'minimal'`, etc.), 헤더 우측 아이콘은 `apps/mobile/src/lib/HeaderIconButton.tsx`(44×44 고정으로 react-native-screens iOS customView stretch 회피). 동적 옵션(notices의 Bell/BellOff 등)은 화면 안에서 inline `<Stack.Screen options={...}/>`. Home 탭 URL은 `/home`. Cold-start root `/`는 `app/+native-intent.tsx`의 `redirectSystemPath`가 `initial: true && path === '/'` 분기에서 `/(tabs)/${resolveInitialTabRouteName(lastTab)}`로 직접 라우팅 — `app/index.tsx`(`<Redirect>`)는 마운트조차 안 됨. 이렇게 하는 이유: 만약 redirect-only 화면이 root Stack history에 남으면 iOS long-press 뒤로가기에서 titleless phantom 항목으로 보이는 결함이 생긴다. 만에 하나 leak되어도 `app/_layout.tsx`의 `<Stack.Screen name="index" options={{ title: t('nav.home') }}/>`가 fallback 라벨 보장. SDUI 'route' action에서 bare `/`도 마찬가지로 `router.dismissTo('/(tabs)/home')`로 가로채서 phantom 회피 (`apps/mobile/src/sdui/action-handler.ts`). Initial tab 복원은 `packages/shared/src/utils/resolveInitialTabRoute.ts` + `useSettingsStore.lastTab`.

**iOS 26 NativeTabs chain root rule (minimize + auto contentInset 동시 게이트):** `<NativeTabs minimizeBehavior="onScrollDown">` 발화 + headerless 화면의 status-bar 영역 자동 contentInset adjustment, **두 동작 모두** 같은 native finder에 게이트된다. 조건은 각 탭 화면의 RNSScreen `subviews[0]` 직계가 `ScrollView`/`SectionList`/`FlatList`여야 한다는 것. **outer wrapping `<View>` 한 겹만 추가돼도, 또는 isLoading 분기가 첫 마운트에 ScrollView가 아닌 view를 두면 두 동작 모두 영구 비활성** (탭 바 minimize 안 됨 + 컨텐츠가 status bar와 겹침). native finder(`RNSScrollViewFinder.mm`)가 strict subviews[0] chain을 명목상 끝까지 따라가지만, `mountChildComponentView(index==0)` 호출 타이밍이 첫 자식의 자식들이 mount되기 전이라 사실상 **1단계 깊이만 보장**되기 때문. RNS는 chain root에 한해 RN ScrollView default `contentInsetAdjustmentBehavior=Never`를 `Automatic`으로 flip해 UIKit-native safe-area 처리로 reverts (`RNSScrollViewHelper.mm:6`). 화면 root는 ScrollView/SectionList를 직계 반환하거나 Fragment(`<>...</>`)의 첫 자식으로 둘 것. **isLoading/error 분기는 ScrollView를 sibling으로 두지 말고 ScrollView 안에서 swap** (children만 분기). selector/header overlay는 absolute positioning + Fragment 두 번째 이후 자식으로 (`<><SectionList listHeaderHeight=…/><View style={absoluteOverlay}>…</View></>` 패턴). loading/empty/error는 SectionList의 `ListEmptyComponent` + `contentContainerStyle.flexGrow:1`로 흡수. 자세한 패턴/안티패턴/native 메커니즘: `docs/explanation/ios-26-native-tabs-minimize.md`.

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

**전체 상세: `docs/explanation/notices-feature.md`** — 서버 주도 탭 레이아웃(`GET /notices/tabs`, fixed/picker), 마크다운 렌더링(`NoticeRenderer` image/paragraph/link 오버라이드), dimension hint 기반 CLS 제거, notice row 메타·deadline badge, 날짜 그루핑(`groupNoticesByDate` 5버킷), 첨부파일 프록시.

**Onboarding gate + 자동복원 (2026-04-28, v2 redesign 2026-05-01):** 공지 탭 진입 게이트는 `isAnonymous || !onboardingCompleted` (`apps/mobile/app/(tabs)/notices/index.tsx`). 둘 중 하나라도 true면 `OnboardingLanding` 표시. `@g.skku.edu` 도메인 필수.

게이트·자동복원의 상세 메커니즘(v2 게이트 화면, 헤더/액세서리 native unmount 이유, 복원 경로 dual-write)은 `docs/explanation/notices-feature.md`. 세션 중 실수 방지 불변식만:

- **자동복원 dual-write 유지**: 인라인 sign-in 핸들러(`notices/index.tsx`) + `useAppInit.ts` `onPreferencesChanged` fallback — 한쪽만 수정하지 말 것 (race-free 근거 = always-overwrite + 동일 데이터).
- **`onboardedAt` discriminator**: rules가 'null→timestamp' 단방향 immutability 강제. 온보딩 완료 게이트는 Firestore write **성공 후**에만 커밋 (유령 상태 방지 — `docs/internal/2026-07-notices-picker-ghost-state.md`).
- **'dept' 키 cross-cutting hard-code**: dept 미러 read 3 sites — `notices/index.tsx` handler, `useAppInit.ts` listener, `functions/src/notifications/tabsContract.ts`. rename은 coordinated 필요.
- **게이트 분기의 header/bottomAccessory는 진짜 unmount 필요** (`headerShown: false` 발화 + accessory prop 자체를 `undefined`로) — 숨김/overlay로 대체 불가.

### Design System (`@skkuverse/sds`)

Provides themed components via `SDSProvider`. Design tokens (colors, typography, spacing, radius, shadows) are centralized in `@skkuverse/shared/tokens/`.

## Deep Link

커스텀 스킴 `skkuverse://`와 유니버셜 링크 `https://skkuverse.com/p/...`로 외부에서 앱 진입 가능. `app/+native-intent.tsx`에서 화이트리스트 기반 필터링 (둘 다 동일 로직).

- **유니버셜 링크 prefix:** `/p/` (예: `skkuverse.com/p/search`) — 앱에서 자동 스트립
- **허용 (정적):** `/`, `/home`, `/campus`, `/transit`, `/map/hssc`, `/search`
- **허용 (동적):** 공지 `/notices/<sourceId>/<articleNo>` — 통과가 아니라 **가로채기**: `pendingExternalNoticeLink.set(...)` 후 `/(tabs)/notices` 반환, root layout의 `PendingNoticeLinkConsumer`가 상세를 push (뒤로가기가 공지 탭에 안착). 미니앱 `/m/<slug>` — registry 등록 slug만 `pendingMiniAppLink.set(...)` 후 `/(tabs)/home` 반환, `PendingMiniAppLinkConsumer`가 오픈.
- **차단:** `/webview`, `/bus/*`, `/sds-preview` 등 나머지 전부 → 홈(`/(tabs)/home`)으로 리다이렉트
- **필터링은 cold/warm 균일:** 화이트리스트·공지·미니앱 로직이 `initial` 여부와 무관하게 동일 적용 (untrusted 딥링크가 `/login`·`/onboarding` 같은 내부 라우트로 push 못 하게). 유일한 분기는 **bare `/`** — cold는 `/(tabs)/<lastTab>` 복원(app/index.tsx 미마운트로 long-press 뒤로가기의 titleless phantom 회피), warm은 `/(tabs)/home`.
- **앱 내부 네비게이션(`router.push`)은 영향 없음** — 단 SDUI 'route' action의 bare `/`는 `router.dismissTo('/(tabs)/home')`로 가로채서 동일한 phantom 회피
- 자세한 내용은 `docs/reference/deep-link.md` 참조

## Key Technical Details

- **Maps:** Naver Maps SDK via `@mj-studio/react-native-naver-map`. Android custom view markers require `renderToHardwareTextureAndroid` + `collapsable={false}` to avoid bitmap snapshot race condition (see `docs/explanation/android-naver-map-markers.md`)
- **Auth/Analytics:** Firebase (auth, analytics, crashlytics, app-check). Google Sign-In (`@g.skku.edu` 도메인 제한). App Check은 iOS App Attest + Android Play Integrity.
- **Push notifications (FCM):** 옵션 D — 알림함 없음, 뱃지는 로컬(Zustand+Notifee), 결정 기록 `docs/decisions/0002`. **전체 아키텍처: `docs/explanation/fcm-architecture.md`** (v5 SSOT·tabsContract·drift sync·delivery·auth transition). 히스토리·과거 디버깅 기록은 `docs/plans/fcm-push-notifications.md` (superseded). 진단 화면 `app/debug-fcm.tsx`는 orphan (진입 버튼 제거됨) — 제거 후보.
- **FCM 불변식 (상세는 fcm-architecture.md):** "기록은 의도, 전송은 파생" — 클라는 intent 필드만 write (derived 필드는 rules 봉쇄), 전부 단일 dot-path `updateDoc` (트랜잭션 금지 — 캠퍼스 wifi dead spot offline 큐잉 보호). `onboardedAt`은 'null→timestamp' 단방향 immutability. MMKV는 device-local state만, preferences는 Firestore listener가 단일 source. 검증: `cd functions && npm run verify:trigger` + `yarn test:rules` (케이스 수·구성은 `firestore.rules.test.mjs`가 권위 — 개수 박제 금지).
- **FCM tabsContract 미러 규율:** `functions/src/notifications/tabsContract.ts`는 skkuverse-server `src/notices/categories.json`(별도 레포)의 하드코딩 미러 — 백엔드 탭 추가 시 **같은 release에서** 미러 갱신 필수 (unknown fixed key는 자체 감지 불가). 컨벤션: picker tab key === topic prefix. 절차 체크리스트: `docs/how-to/add-notice-tab.md`.
- **FCM drift sync / delivery 주의:** `syncPreferencesToDevices` 설정·`sendNotification` 인증·로깅 상세는 `docs/explanation/fcm-architecture.md`. 불변식 하나만: `TOKEN_CLEANUP_CODES`에 `messaging/invalid-argument` 추가 금지 — payload-wide 에러라 healthy device 대량 `active:false` footgun.
- **Firestore 디버깅:** 증상별 판별표("잠깐 반영 후 revert"=rules 거부 등)·REST server truth 조회·updateTime 비교 절차는 `docs/how-to/firestore-debugging.md`.
- **FCM auth transition 불변식:** 새 sign-in 경로를 추가하면 반드시 pre-`unregisterDevice` → sign-in → `await initializeFirestoreNotifications` 패턴을 미러할 것 (`OnboardingScreen.handleSignIn`·`app/login.tsx` 참조). rule 시맨틱 "active는 owner만, inactive는 claim 가능" — 상세: `docs/explanation/fcm-architecture.md`.
- **App Check:** 디버그 토큰 주입 경로(env만 유효 — UserDefaults fallback은 시뮬레이터+prebuild 조합에서 silently 무시)·EAS 프로필별 자동 strip·Play Integrity 스로틀 대응(prime 캐시)은 `docs/explanation/app-check.md`. 시뮬레이터 토큰 교환 실패 시 Firebase Console debug token 등록부터 확인.
- **Data storage 원칙:** 유저 데이터는 모두 **Firebase** (Firestore/Auth), 공공 데이터(공지사항, 건물정보, 버스 등)는 **MongoDB** (백엔드 API 경유)
- **Local storage:** `react-native-mmkv` for general state, `expo-secure-store` for sensitive data
- **Animations:** React Native Reanimated 4 + Gesture Handler 2
- **Bottom sheets:** `@gorhom/bottom-sheet`
- **Icons:** `phosphor-react-native` (모든 일반 UI 아이콘). 컴포넌트 명은 `*Icon` 접미사 사용 (예: `<HouseIcon weight="fill" />`). `weight` prop으로 outline(`regular`) / filled(`fill`) 분기. 탭바 4개 아이콘만 별도 — `apps/mobile/assets/tab-icons/*.png`로 사전 export(@phosphor-icons/core SVG → resvg via `apps/mobile/scripts/export-tab-icons.mjs`), iOS NativeTabs `<Icon src=...>`에 require()로 주입.
- **이모지 (Tossface):** 채색 이모지 표현은 Tossface 폰트 기반. `src/components/TossfaceButtonGrid.tsx` (홈/캠퍼스 그리드 메뉴), `src/features/notifications/NoticesSettingsScreen.tsx` (9탭 카테고리 매핑), `src/sdui/widgets/Notice.tsx` (📢 megaphone), `src/features/bus/schedule/StatusCards.tsx` (🚌 bus). `\u{1F4AC}` 같은 codepoint 또는 직접 이모지 문자 사용. Phosphor outline 아이콘과 시각/의미가 다르므로 대체 불가 — 채색 표현이 필요한 곳만 Tossface, 그 외엔 Phosphor.
- **TypeScript strict mode** enabled across the monorepo
- **iOS bundle ID:** `com.example.skkumap` / **Android package:** `com.zoyoong.skkubus`
- **개발 실행:** Expo Go 사용하지 않음. **CNG (Continuous Native Generation)** 방식으로 `yarn ios` (`expo run:ios`) / `yarn android` (`expo run:android`)로 네이티브 빌드 직접 실행. 커스텀 네이티브 모듈(Firebase, Naver Maps 등) 사용을 위해 항상 네이티브 빌드 필요.
- **네이티브 변경 후 실행:** 네이티브 코드에 영향을 주는 변경(패키지 추가/삭제, `app.config.ts` plugins 변경, 네이티브 모듈 설정 등) 후에는 반드시 `npx expo prebuild --clean` 후 `yarn ios` / `yarn android`로 실행
- **EAS Build:** Configured in `apps/mobile/eas.json` (dev/preview/production profiles)
- **Naver Map patch:** `patches/@mj-studio+react-native-naver-map+2.7.0.patch` (nil iconImage crash fix)
- **Android dev environment:** CLI-only SDK (no Android Studio IDE), JDK 17, `ANDROID_HOME=~/Library/Android/sdk`

## Build & Deploy (로컬 빌드)

이 프로젝트는 **EAS Build `--local`** + **Fastlane**으로 로컬에서 빌드/배포함. EAS 클라우드 빌드 안 씀. 자세한 내용은 `docs/how-to/ios-build-deploy.md`, `docs/how-to/android-build-deploy.md` 참조.

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
- **EAS 로컬 빌드 monorepo 필수 설정 (둘 다 없으면 embed 번들 단계에서 `Unable to resolve module .../apps/mobile/index.ts` → `ARCHIVE FAILED`):** (1) `eas.json` beta/production env에 **`EXPO_NO_METRO_WORKSPACE_ROOT=1`** — 최근 @expo/cli가 Metro workspace-root를 기본 ON으로 바꿔, EAS 샌드박스(nested `apps/mobile/node_modules` 생성)에서 서버 루트가 monorepo 루트가 되며 `tsconfig` `@/` paths가 깨짐. (2) iOS 빌드 스크립트가 **`export TMPDIR="$HOME/.eas-build-tmp"`** (심볼릭 없는 경로) — `/tmp`·`/var/folders`는 `/private/...` 심볼릭이라 엔트리(심볼릭)와 Metro 서버 루트(realpath)가 불일치. **이 실패는 로컬 repo에선 재현 안 됨**(완전 호이스팅); 디버깅은 빌드 도중 살아있는 EAS 샌드박스에서 직접 `expo export:embed` 재현. 풀빌드 반복 금지. 자세한 내용 `docs/how-to/ios-build-deploy.md` Troubleshooting.
- **Release Notes**: 배포 전에 `fastlane/metadata/` 아래 locale별 파일 수정 → 업로드 시 자동 포함
  - Android: `metadata/android/{ko-KR,en-US,zh-CN}/changelogs/default.txt` (최대 500자)
  - iOS: `metadata/ios/{ko,en-US,zh-Hans}/release_notes.txt` (최대 4000자)

## OTA 업데이트

셀프호스팅 expo-open-ota 서버 (`https://ota.skkuverse.com`). 자세한 내용은 `docs/how-to/ota-update.md` 참조.

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
