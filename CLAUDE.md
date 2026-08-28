# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

Documents follow the Diátaxis structure (`docs/how-to|reference|explanation|decisions|internal|plans`). **Before writing or editing any document, read `docs/README.md`**, which is the index and the SSOT for the writing rules: the frontmatter schema, kebab-case naming, and the rule against copying a value (point at the source-of-truth file for a version or a measurement). Markdown lint is `yarn lint:md`, chained into the root `yarn lint`.

The markdownlint rule set is vendored from the umbrella as `.markdownlint.jsonc` under the `conventions.markdownlint` contract, so edit it upstream rather than here. Everything under `docs/`, plus `README.md` and this file, is English by fleet policy, checked by the umbrella's `lint_conventions.py`. Korean that is genuinely product copy carries a `conventions:allow-korean` marker on its line.

## Project Overview

Skkuverse is a university campus app (SKKU) built as a **Yarn workspaces monorepo** for the React Native mobile app. Every browser surface — the pages the app loads in a web view, and the admin console — lives in the sibling repo [skkuverse-web](https://github.com/spencer0124/skkuverse-web); see [umbrella ADR 0005](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0005-web-surfaces-dedicated-repo.md).

## Monorepo Layout

- **`apps/mobile/`** — Expo 54 + React Native 0.81 mobile app (iOS/Android)
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
yarn lint             # expo lint (ESLint)
npx expo prebuild --clean  # clean prebuild after a native change

# Root
yarn typecheck        # tsc --noEmit across apps/mobile and all three packages
yarn lint             # ESLint (--max-warnings 0) across the monorepo, then markdownlint
yarn test             # packages/shared (vitest) + apps/mobile (node:test)
yarn test:rules       # Firestore rules tests (Firestore emulator + node:test)
                      # scripts/test-rules.sh finds a JDK 21+ by probing versions.
                      # Must be green before deploying rules.
```

Firestore rules are defined in `apps/mobile/firestore.rules`. To deploy:

```bash
firebase deploy --only firestore:rules
```

Node version is pinned to **22** (see `.nvmrc`), matching `functions/package.json` engines and what `--experimental-strip-types` requires.

CI runs all of the above. `.github/workflows/ci.yml` has four jobs: `conventions` (contract integrity and the umbrella's shared conventions), `workspace` (typecheck, lint, tests), `functions`, and `rules`. **A new workflow file needs a `!` line in `.gitignore`**, which makes `.github/` an allowlist — without it the file is untracked and never runs, with no error.

## Architecture

### Mobile App (`apps/mobile/`)

**Routing:** Expo Router (file-based). Route files live in `app/`, feature code in `src/features/`.

**Provider stack** (defined in `app/_layout.tsx`):

```text
ErrorBoundary → GestureHandlerRootView → SafeAreaProvider → SDSProvider → QueryProvider → InitGate → BottomSheetModalProvider → Stack
```

`SafeAreaProvider` is **explicit at root** (the pattern both rnsac and the Expo docs recommend) AND **also re-mounted inside each modal route** (e.g. `app/onboarding.tsx`). Modal routes registered with `presentation: 'fullScreenModal'` / `'modal'` mount in a separate native UIViewController; the root provider measures the wrong VC's insets, so the modal's first paint loses top safe area. Per-modal `<SafeAreaProvider>` wrap is mandatory for any modal screen — see `docs/explanation/ios-modal-safe-area-provider.md`.

**Tab structure (per-tab nested Stack):** inside the `app/(tabs)/` group, the four tab directories (`home/`, `campus/`, `transit/`, `notices/`) each have their own `_layout.tsx` (`<Stack screenOptions={defaultHeaderOptions}/>`) plus an `index.tsx` holding the screen. Because each tab owns an independent Stack, switching tabs never toggles a parent Stack's `headerShown`, which is what would otherwise slide the content up and down as a layout shift. Headers use the `react-native-screens` native-stack directly (iOS UINavigationController, Android Toolbar). The shared options are in `apps/mobile/src/lib/header-options.ts` (`headerTitleAlign:'center'`, `headerBackButtonDisplayMode:'minimal'`, etc.), and a header's right-hand icon goes through `apps/mobile/src/lib/HeaderIconButton.tsx`, fixed at 44×44 to avoid the react-native-screens iOS customView stretch. Options that vary at runtime, such as notices' Bell and BellOff, are set inline inside the screen with `<Stack.Screen options={...}/>`. The home tab's URL is `/home`. On a cold start, root `/` is routed directly by `redirectSystemPath` in `app/+native-intent.tsx`, whose `initial: true && path === '/'` branch returns `/(tabs)/${resolveInitialTabRouteName(lastTab)}`, so `app/index.tsx` (a `<Redirect>`) never mounts at all. The reason: a redirect-only screen left in the root Stack history appears as a titleless phantom entry in the iOS long-press back menu. Should one ever leak through, `<Stack.Screen name="index" options={{ title: t('nav.home') }}/>` in `app/_layout.tsx` guarantees a fallback label. A bare `/` arriving through an SDUI 'route' action is intercepted the same way, with `router.dismissTo('/(tabs)/home')` (`apps/mobile/src/sdui/action-handler.ts`). Restoring the initial tab is `packages/shared/src/utils/resolveInitialTabRoute.ts` plus `useSettingsStore.lastTab`.

**iOS 26 NativeTabs chain root rule (one gate for both minimize and automatic contentInset):** `<NativeTabs minimizeBehavior="onScrollDown">` firing, and the automatic contentInset adjustment for the status-bar area on a headerless screen, **are both** gated by the same native finder. The condition is that each tab screen's RNSScreen `subviews[0]` is directly a `ScrollView`, `SectionList` or `FlatList`. **One outer wrapping `<View>`, or an isLoading branch that mounts something other than a ScrollView first, kills both permanently** (the tab bar never minimizes and the content overlaps the status bar). The native finder (`RNSScrollViewFinder.mm`) nominally follows the strict subviews[0] chain the whole way down, but `mountChildComponentView(index==0)` is called before the first child's own children have mounted, so in practice **only one level of depth is guaranteed**. For the chain root alone, RNS flips React Native's ScrollView default `contentInsetAdjustmentBehavior=Never` to `Automatic`, reverting to UIKit-native safe-area handling (`RNSScrollViewHelper.mm:6`). A screen's root has to return a ScrollView or SectionList directly, or place one as the first child of a Fragment (`<>...</>`). **An isLoading or error branch must not sit as a sibling of the ScrollView; swap inside it** (branch on the children alone). A selector or header overlay goes in absolute positioning as the second or later child of the Fragment (the `<><SectionList listHeaderHeight=…/><View style={absoluteOverlay}>…</View></>` pattern). Loading, empty and error states are absorbed by SectionList's `ListEmptyComponent` with `contentContainerStyle.flexGrow:1`. The patterns, anti-patterns and native mechanism in detail: `docs/explanation/ios-26-native-tabs-minimize.md`.

**Feature modules** (`src/features/`): `home`, `bus`, `map`, `building`, `search`, `notices` — each self-contained with components, hooks, and utils.

**Server-Driven UI (SDUI):** The home screen fetches section configs from the backend and renders them via widget components in `src/sdui/widgets/`.

**Path aliases** (tsconfig): `@/*` → `./src/*`, `@skkuverse/*` → `../../packages/*/src`.

> [!WARNING]
> `apps/mobile/tsconfig.json` includes `.expo/types/**/*.ts`, and `router.d.ts` in there is generated by the Metro dev server and gitignored. Code must compile without it, since a clean checkout and CI have no such file. Nothing but the dev server generates it.

### Data Layer (in `@skkuverse/shared`)

- **API client:** Axios with auth interceptor and retry. Requests wrapped in `Result<T>` (success/failure union).
- **Stores:** `useAuthStore` (Firebase auth), `useSettingsStore` (campus, language, lastTab), `useMapLayerStore`.
- **React Query hooks:** `useCampusSections`, `useTransitList`, `useBusConfig`, `useMapConfig`, `useBuildings`, etc.
- **i18n:** `useT()` hook, `SUPPORTED_LANGUAGES`.

### Web surfaces (sibling repo)

The pages the app loads in a web view ship from [skkuverse-web](https://github.com/spencer0124/skkuverse-web) `apps/webview`, deployed to `webview.skkuverse.com` on Cloudflare Pages. They are not in this repo.

What crosses the boundary is `packages/bridge` — the message contract, vendored there and hash-checked by the umbrella's contract registry — and the design token values in `packages/shared/src/tokens/`. Components do not cross: `packages/sds` is React Native. Editing the vendored copy on the web side turns its CI red; change it here instead.

The origin allowlist that grants those pages the native bridge is **server-owned** (`skkuverse-server` `src/infra/origins.ts` → `GET /app/config`), so a new host grants nothing until the server ships it.

### Notices Feature (`src/features/notices/`)

**Full detail: `docs/explanation/notices-feature.md`** — the server-driven tab layout (`GET /notices/tabs`, fixed and picker), markdown rendering (the `NoticeRenderer` image, paragraph and link overrides), removing layout shift with the dimension hint, notice row metadata and the deadline badge, date grouping (`groupNoticesByDate`, five buckets), and the attachment proxy.

**Onboarding gate and automatic restore (2026-04-28, v2 redesign 2026-05-01):** the notices tab gate is `isAnonymous || !onboardingCompleted` (`apps/mobile/app/(tabs)/notices/index.tsx`). If either is true it shows `OnboardingLanding`. An account has to be on the `@g.skku.edu` domain.

The gate and restore mechanisms in detail (the v2 gate screen, why the header and accessory need a native unmount, the dual-write restore paths) are in `docs/explanation/notices-feature.md`. Only the invariants worth keeping in mind mid-session:

- **Keep the automatic-restore dual write.** The inline sign-in handler (`notices/index.tsx`) and the `onPreferencesChanged` fallback in `useAppInit.ts` are both required, so never change one alone. They are race-free because both always overwrite with identical data.
- **The `onboardedAt` discriminator.** The rules enforce one-way immutability from null to a timestamp. The onboarding-complete gate is committed only **after** the Firestore write succeeds, which is what prevents the ghost state — see `docs/internal/2026-07-notices-picker-ghost-state.md`.
- **The 'dept' key is hardcoded across three places.** The department mirror is read in the `notices/index.tsx` handler, the `useAppInit.ts` listener, and `functions/src/notifications/tabsContract.ts`. Renaming it needs a coordinated change.
- **The gate branch has to genuinely unmount the header and bottomAccessory** (fire `headerShown: false`, and make the accessory prop itself `undefined`). Hiding one or covering it with an overlay does not work.

### First-launch intro (`src/features/intro/`, 2026-08-28)

A four-page value tour (shuttle → campus map → AI notices → Google sign-in, skippable) shown **once** to every user who is not signed in with a Google account. Not to be confused with the 7-step notices wizard above: different flag, different audience, different mount. **Full detail: `docs/explanation/first-launch-intro.md`.** The invariants worth knowing mid-session:

- **`introSeen` and `onboardingCompleted` are different gates.** `introSeen` (`packages/shared/src/store/settings.ts`) only records that the tour was shown; it never unlocks the notices tab. It was added without a store version bump on purpose, so an install predating the key falls back to `false` and gets toured once.
- **The intro is a branch of `InitGate`, not a route.** It replaces `children` the way `ForceUpdateScreen` does, so nothing mounts behind it and it is not a deep-link surface. It waits on `authStore.isInitialized` — **not** just `isReady` — because `isAnonymous` defaults to true and Firebase answers after `useAppInit` finishes; a ref then freezes the decision so signing in on the last page cannot unmount the screen mid-flow.
- **Sign-in is the last step and routes nowhere.** `classifyAndRestoreOnboarding` is still called, but purely for its restore side effect; the `kind` is ignored. A new user meets the notices wizard later, from the notices tab.
- **The wizard's `skipLogin` is frozen at mount.** `OnboardingState.skipLogin` comes from `authStore` in the lazy initializer, and makes `NEXT` 3→5 and `PREV` 5→3. Never recompute it from live `isAnonymous`, which flips mid-wizard.
- **`reducer.ts` must stay free of relative runtime imports.** `node --experimental-strip-types --test` erases the type-only `./types` import; a value import would break `reducer.test.mts`. That is why `MAX_INTEREST_DEPTS` lives there.

### Design System (`@skkuverse/sds`)

Provides themed components via `SDSProvider`. Design tokens (colors, typography, spacing, radius, shadows) are centralized in `@skkuverse/shared/tokens/`.

## Deep Link

The app can be entered from outside through the custom scheme `skkuverse://` and universal links at `https://skkuverse.com/p/...`. Both are filtered against the same whitelist in `app/+native-intent.tsx`.

- **`/p/` is the "shared link" namespace** (for example `skkuverse.com/p/notices/cse/5847`), and the app strips it automatically. **Only a path with a web landing page** gets `/p/` and an AASA entry, which today means notices and mini apps alone. Home, campus, transit, search and the map are not links you send to someone and have no page to land on, so they are **custom scheme only** — by design rather than by omission. The app code does not distinguish the two; the only difference is whether the path is listed in the AASA.
- **Allowed (static):** `/`, `/home`, `/campus`, `/transit`, `/map/hssc`, `/search`
- **Allowed (variable):** a map place, `/map?place=<placeId>`, is **intercepted** by `MAP_PATH_RE = /^\/map$/` rather than whitelisted, and the anchor's `$` is what protects `/map/hssc`. The `placeId` is checked for shape only. A notice, `/notices/<sourceId>/<articleNo>`, is also **intercepted** rather than passed through: `pendingExternalNoticeLink.set(...)` runs and `/(tabs)/notices` is returned, then the root layout's `PendingNoticeLinkConsumer` pushes the detail, so the back gesture arrives at the notices tab. A mini app, `/m/<slug>`, is checked for **shape only** (`MINIAPP_PATH_RE`) and its registry membership is not verified here: the slug goes into `pendingMiniAppLink.set(...)`, `/(tabs)/home` is returned, and the root layout's `PendingMiniAppLinkConsumer` checks it with `GET /miniapps/:id`, opening the shell or **dropping it silently** (for an unknown slug and for a failed lookup alike, neither of which is a dead end since the user is already on home). Why the check does not happen here is in the mini app section of `docs/reference/deep-link.md`.
- **Blocked:** everything else, including `/webview`, `/bus/*` and `/sds-preview`, redirects to home (`/(tabs)/home`).
- **Filtering is identical on cold and warm starts:** the whitelist, notice and mini app logic all apply regardless of `initial`, so an untrusted deep link cannot push an internal route such as `/login` or `/onboarding`. The only branch is **bare `/`**: cold restores `/(tabs)/<lastTab>` (never mounting app/index.tsx, which avoids the titleless phantom in the long-press back menu), and warm goes to `/(tabs)/home`.
- **Navigation inside the app (`router.push`) is unaffected** — except that a bare `/` in an SDUI 'route' action is intercepted with `router.dismissTo('/(tabs)/home')`, avoiding the same phantom.
- See `docs/reference/deep-link.md` for the detail.

## Key Technical Details

- **Map chips are server-driven, and are not the event map's chips.** `GET /map/config` serves `chips` beside `layers`; a chip carries an **action** (`webview` or `focus`) and a layer set, while the event map's chips carry a predicate over snapshot items. The rule most easily got wrong: a `focus` chip's `layerIds` mean **"within this `chipGroupId`, set exactly these"** — named on, unnamed sibling off, everything outside the group untouched — so the write has to resolve the group first. That resolution lives once, in `packages/shared/src/map/chips.ts`, and no call site repeats it. Which chip is active is derived from layer visibility, never stored. Contract: `docs/reference/map-config-api-spec.md`.
- **Maps:** Naver Maps SDK via `@mj-studio/react-native-naver-map`. Android custom view markers require `renderToHardwareTextureAndroid` + `collapsable={false}` to avoid bitmap snapshot race condition (see `docs/explanation/android-naver-map-markers.md`)
- **The campus toggle never moves on its own.** It holds exactly one campus and only the user changes it; when the camera ends up somewhere else — pressing locate is the ordinary way — a card in the map's lower row offers the difference instead. Markers are deliberately NOT filtered by campus, so whatever is under the camera is always drawn. The decision is `resolveCampusSuggestion`, a pure function unit-tested against the real coordinates, and the radius that defines "inside a campus" is served as `campuses[].radiusM` with a permanent client fallback (neither side may assume the other has shipped). One invariant belongs here: **an explicit camera request is answered by a decision, not by the first camera idle** — switching tracking on emits an idle while the camera is still at the old position, and consuming the request there makes the real answer look like drift, which the explicit-action rule then suppresses silently. There are two such requests, a locate press and a **map chip tap**, and both raise the same ref (`awaitingExplicitCameraResult`) so a chip that flies to the festival ground switches the toggle silently rather than being followed by a card asking about the campus it just took you to. Detail: ADR 0008 and `docs/explanation/campus-map-reconciliation.md`.
- **Auth/Analytics:** Firebase (auth, analytics, crashlytics, app-check). Google Sign-In, restricted to the `@g.skku.edu` domain. App Check is iOS App Attest plus Android Play Integrity.
- **Push notifications (FCM):** option D, meaning no inbox, with the badge computed locally through Zustand and Notifee. The decision is recorded in `docs/decisions/0002`. **The full architecture is `docs/explanation/fcm-architecture.md`** (the v5 SSOT, tabsContract, drift sync, delivery, auth transitions). The history is `docs/plans/fcm-push-notifications.md` (superseded), and the preferences-to-devices drift incident is `docs/internal/2026-04-fcm-preferences-devices-drift.md`. On-device diagnosis is `app/settings/debug-logs.tsx`.
- **FCM invariants (detail in fcm-architecture.md):** what is recorded is intent, what is sent is derived. The client writes intent fields alone, since the rules close off the derived ones, and every write is a single dot-path `updateDoc` with **no transaction**, which is what protects offline queueing in a campus wifi dead spot. `onboardedAt` is one-way immutable, null to a timestamp. MMKV holds device-local state alone, and a Firestore listener is the single source for preferences. Verify with `cd functions && npm run verify:trigger` and `yarn test:rules` (the case count and composition are `firestore.rules.test.mjs`'s to state — never freeze a number here).
- **The FCM tabsContract mirror discipline:** `functions/src/notifications/tabsContract.ts` is a hardcoded mirror of `src/notices/categories.json` in the separate skkuverse-server repo. When the backend adds a tab, the mirror has to be updated **in the same release**, because an unknown fixed key cannot be detected on this side. The convention is that a picker tab key is its topic prefix. The procedure is `docs/how-to/add-notice-tab.md`.
- **FCM drift sync and delivery:** the `syncPreferencesToDevices` settings, and `sendNotification`'s authentication and logging, are detailed in `docs/explanation/fcm-architecture.md`. One invariant belongs here: **never add `messaging/invalid-argument` to `TOKEN_CLEANUP_CODES`.** It is a payload-wide error, so allowlisting it is a footgun that flips healthy devices to `active:false` en masse.
- **Firestore debugging:** the symptom triage table (a change that appears then reverts means the rules rejected it, and so on), reading server truth over REST, and comparing `updateTime` are all in `docs/how-to/firestore-debugging.md`.
- **The FCM auth transition invariant:** any new sign-in path has to mirror the pattern of `unregisterDevice` first, then sign in, then `await initializeFirestoreNotifications` (see `OnboardingScreen.handleSignIn` and `app/login.tsx`). The rule semantics are that an active document is owner-only while an inactive one is claimable. Detail: `docs/explanation/fcm-architecture.md`.
- **App Check:** how a debug token is injected (only the env path works, since the UserDefaults fallback is silently ignored on the simulator with this prebuild), the automatic strip per EAS profile, and handling Play Integrity throttling with a primed cache are all in `docs/explanation/app-check.md`. When a token exchange fails on the simulator, check the Firebase console debug token registration first.
- **Data storage principle:** all user data lives in **Firebase** (Firestore and Auth), and public data such as notices, building information and buses lives in **MongoDB**, reached through the backend API.
- **Local storage:** `react-native-mmkv` for general state, `expo-secure-store` for sensitive data
- **Animations:** React Native Reanimated 4 + Gesture Handler 2
- **Bottom sheets:** `@gorhom/bottom-sheet`
- **Icons:** `phosphor-react-native` for every ordinary UI icon. Component names carry the `*Icon` suffix, as in `<HouseIcon weight="fill" />`, and the `weight` prop switches between outline (`regular`) and filled (`fill`). The four tab bar icons are the exception: they are pre-exported to `apps/mobile/assets/tab-icons/*.png` (from @phosphor-icons/core SVG through resvg, by `apps/mobile/scripts/export-tab-icons.mjs`) and injected into the iOS NativeTabs `<Icon src=...>` with require().
- **Emoji (Tossface):** coloured emoji are rendered with the Tossface font, in `src/components/TossfaceButtonGrid.tsx` (the home and campus grid menus), `src/features/notifications/NoticesSettingsScreen.tsx` (the nine tab category mappings), `src/sdui/widgets/Notice.tsx` (📢 megaphone), and `src/features/bus/schedule/StatusCards.tsx` (🚌 bus). Use either a codepoint such as `\u{1F4AC}` or the emoji character directly. A Phosphor outline icon looks and means something different, so the two are not interchangeable: Tossface where a coloured mark is needed, Phosphor everywhere else.
- **TypeScript strict mode** enabled across the monorepo
- **iOS bundle ID:** `com.example.skkumap` / **Android package:** `com.zoyoong.skkubus`
- **Running in development:** Expo Go is not used. Everything runs as a real native build through **CNG (Continuous Native Generation)**, with `yarn ios` (`expo run:ios`) or `yarn android` (`expo run:android`). The custom native modules, Firebase and Naver Maps among them, make a native build mandatory.
- **After a native change:** anything that affects native code — adding or removing a package, changing plugins in `app.config.ts`, changing a native module's configuration — needs `npx expo prebuild --clean` followed by `yarn ios` or `yarn android`.
- **EAS Build:** Configured in `apps/mobile/eas.json` (dev/preview/production profiles)
- **Naver Map patch:** `patches/@mj-studio+react-native-naver-map+2.7.0.patch` (nil iconImage crash fix)
- **Android dev environment:** CLI-only SDK (no Android Studio IDE), JDK 17, `ANDROID_HOME=~/Library/Android/sdk`

## Build & Deploy (local builds)

This project builds and releases locally with **EAS Build `--local`** plus **Fastlane**. EAS cloud builds are not used. Detail is in `docs/how-to/ios-build-deploy.md` and `docs/how-to/android-build-deploy.md`.

```bash
cd apps/mobile

# iOS
./scripts/ios-build.sh         # build the .ipa only
./scripts/ios-beta.sh          # build + TestFlight
./scripts/ios-release.sh       # build + App Store

# Android
./scripts/android-build.sh     # build the .aab only
./scripts/android-beta.sh      # build + Google Play internal testing
./scripts/android-release.sh   # build + Google Play production (draft)
```

**Applies to both platforms:**

- `credentials.json` holds the iOS credentials (dist.p12 plus mobileprovision) and the Android one (upload-keystore.jks)
- The `production` profile in `eas.json` requires `"credentialsSource": "local"`
- `.easignore` applies in place of `.gitignore`, so the Firebase config and `certs/certificate.pem` have to stay included in the build. **`.env` is deliberately excluded**, because the App Check debug tokens it holds are real secrets — a registered token mints valid App Check tokens and bypasses App Attest and Play Integrity outright — and the build no longer needs anything from it
- **The API host is a committed constant, and on a shipping profile the environment cannot influence it.** `PROD_API_URL` lives in `apps/mobile/config/constants.js`; `resolveBaseUrl()` in `apps/mobile/app.config.ts` returns it directly and **does not read `EXPO_PUBLIC_BASE_URL` at all** whenever `EAS_BUILD_PROFILE` **or** `RELEASE_CHANNEL` names `beta`/`production` — not defaulted, ignored, so a dev host is unrepresentable in a release artifact no matter what `.env`, an exported shell variable or a hand-run `eas`/`eoas` says. A native build announces itself through the first variable, an OTA publish through the second, and only checking both covers the publish path (the App Check debug-token strip keys on the same pair). Off a shipping profile the variable is an optional local override that also defaults to `PROD_API_URL`, so `expo run:ios` against a dev server still works — and a `__DEV__` session on the production host shows the `DevProdHostBanner` strip. `packages/shared/src/api/config.ts` still throws at module init if `extra.baseUrl` is missing at runtime, which now only an old OTA manifest can cause. The reason it is this strict: OTA updates on the 1.0.0 and 3.5.0 runtime channels shipped with the variable unset and silently talked to the old hardcoded host for months
- `autoIncrement: true` is set on both the beta and production profiles and works under `--local`. EAS keeps the remote version per platform, and `buildNumber` in `app.config.ts` is ignored, surviving only in the expo-constants manifest
- `expo-channel-name` is injected automatically by EAS cloud alone, so **a local build has to set it by hand in `updates.requestHeaders` in `app.config.ts`**
- The Android build scripts set `JAVA_HOME` (JDK 17) and `ANDROID_HOME` themselves
- iOS bundle ID: `com.example.skkumap` / Android package: `com.zoyoong.skkubus`
- **Two settings a local EAS build needs in this monorepo. Without both, the embed bundle step fails with `Unable to resolve module .../apps/mobile/index.ts` and `ARCHIVE FAILED`:** (1) **`EXPO_NO_METRO_WORKSPACE_ROOT=1`** in the beta and production env in `eas.json`, because a recent @expo/cli turned the Metro workspace-root on by default, and in the EAS sandbox (which creates a nested `apps/mobile/node_modules`) the server root becomes the monorepo root, which breaks the `tsconfig` `@/` paths. (2) **`export TMPDIR="$HOME/.eas-build-tmp"`** in the iOS build script, a path with no symlink, because `/tmp` and `/var/folders` are symlinks to `/private/...`, leaving the entry (symlinked) and Metro's server root (realpath) mismatched. **This failure does not reproduce in the local repo**, which is fully hoisted; debug it by running `expo export:embed` directly inside a live EAS sandbox during a build. Do not repeat full builds. Detail in the troubleshooting section of `docs/how-to/ios-build-deploy.md`.
- **Release notes:** edit the per-locale files under `fastlane/metadata/` before releasing, and they are included automatically at upload
  - Android: `metadata/android/{ko-KR,en-US,zh-CN}/changelogs/default.txt` (up to 500 characters)
  - iOS: `metadata/ios/{ko,en-US,zh-Hans}/release_notes.txt` (up to 4000 characters)

## OTA updates

A self-hosted expo-open-ota server at `https://ota.skkuverse.com`. Detail in `docs/how-to/ota-update.md`.

```bash
cd apps/mobile

# beta (TestFlight and Internal Testing users only)
./scripts/ota-beta.sh

# production (App Store and Play Store users only)
./scripts/ota-release.sh
```

- **Channels:** a build from a beta script (`*-beta.sh`) takes the "beta" channel, and one from a release script (`*-release.sh`) takes "production". `app.config.ts` decides from the `EAS_BUILD_PROFILE` variable.
- **runtimeVersion:** a fixed string, whose real value is in `apps/mobile/app.config.ts`. It is raised by hand only when native code changes. The fingerprint approach is avoided because EAS build and eoas disagree on the hash.
- **EXPO_TOKEN:** stored in `.env.ota.local`, which is gitignored, and read automatically by the OTA scripts.
- **The workflow:** publish to beta, verify, then publish to production.
- **Publishable over OTA:** UI changes, business logic, added assets, and anything else that is JS-only.
- **Needs a native rebuild:** a new native module, an SDK upgrade, or a change to `app.config.ts` plugins. Each of those requires a `runtimeVersion` bump.
