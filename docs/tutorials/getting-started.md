---
title: Getting Started
type: tutorial
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# Getting Started

> 새 머신에서 클론부터 시뮬레이터/에뮬레이터로 앱을 띄우기까지, 처음 합류한 개발자를 위한 손잡고 따라가는 튜토리얼.

> [!NOTE]
> 이 문서는 "따라 하면 앱이 뜬다"가 목표다. 각 단계가 왜 그런지는 [explanation/architecture.md](../explanation/architecture.md)에서, 빌드·배포 절차는 [how-to/](../how-to/) 런북에서 다룬다.

## 준비물

시작하기 전에 아래 도구를 갖춘다.

| 도구 | 버전/설정 | 확인 방법 |
| --- | --- | --- |
| Node.js | `.nvmrc`에 고정된 버전 — `nvm use` 한 번이면 맞춰진다 | `node -v` |
| Yarn | 1.x (classic, workspaces 관리자) | `yarn -v` |
| Xcode | iOS 빌드용 (App Store에서 설치 + Command Line Tools) | `xcodebuild -version` |
| JDK | 17 (Android 빌드용) | `java -version` |
| Android SDK | CLI-only 설치, `ANDROID_HOME=~/Library/Android/sdk` — Android Studio IDE는 쓰지 않는다 | `echo $ANDROID_HOME` |

> [!WARNING]
> **Expo Go는 사용하지 않는다.** 이 앱은 커스텀 네이티브 모듈(Firebase, Naver Maps 등)을 쓰기 때문에 CNG(Continuous Native Generation) 방식으로 항상 네이티브 빌드를 직접 실행한다. Expo Go에서 QR을 찍어도 동작하지 않는다.

## 1. 클론하고 의존성 설치

레포를 클론하고 **루트에서** 설치한다. Yarn workspaces 모노레포라 루트 한 번이면 `apps/*`와 `packages/*`가 전부 설치된다.

```bash
git clone <repo-url> skkuverse-app
cd skkuverse-app
nvm use          # .nvmrc 버전으로 전환
yarn install
```

설치 마지막에 `postinstall`이 `patch-package`를 자동 실행해 `patches/` 아래의 라이브러리 패치를 적용한다. 패치 적용 로그가 에러 없이 지나갔는지 한 번 확인하자 — 패치가 안 붙으면 지도 마커 등에서 런타임 크래시가 난다.

## 2. 비밀 파일 준비

레포에 커밋되지 않는 파일들이 있다. 기존 팀원(또는 본인의 다른 머신)에게서 받아 제자리에 놓는다.

1. **`apps/mobile/.env`** — `EXPO_PUBLIC_*` 환경변수 모음. 필요한 키 목록은 루트 [README.md](../../README.md)의 Environment 섹션과 `apps/mobile/app.config.ts`에서 확인한다.
2. **Firebase 설정 파일** — `apps/mobile/google-services.json` (Android), `apps/mobile/GoogleService-Info.plist` (iOS). Firebase Console에서 다운로드하거나 별도 수급.
3. **App Check 디버그 토큰 (iOS 시뮬레이터용)** — 시뮬레이터는 App Attest를 못 쓰므로 `.env`의 `FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS`가 필요하다. 같은 UUID 값이 Firebase Console → App Check → iOS 앱 → Manage debug tokens에 등록되어 있어야 토큰 교환이 된다.

## 3. iOS로 첫 실행

이제 앱을 띄워 보자. `apps/mobile`로 이동해서 실행한다.

```bash
cd apps/mobile
yarn ios
```

`yarn ios`는 타입체크(`tsc --noEmit`)를 먼저 돌린 뒤 `expo run:ios`로 네이티브 빌드 → 시뮬레이터 설치 → Metro 번들러 연결까지 해 준다. 첫 빌드는 CocoaPods 설치와 네이티브 컴파일 때문에 시간이 꽤 걸린다 — 커피 한 잔 타이밍.

시뮬레이터에서 앱이 뜨고 홈 탭이 보이면 성공이다.

## 4. Android로 실행

Android도 같은 위치에서 한 줄이다.

```bash
cd apps/mobile
yarn android
```

에뮬레이터가 켜져 있거나 실기기가 연결되어 있어야 한다. `JAVA_HOME`이 JDK 17을 가리키는지, `ANDROID_HOME`이 설정되어 있는지 먼저 확인하자.

## 5. 언제 `prebuild --clean`이 필요한가

일상적인 JS 코드 수정은 Metro가 핫 리로드해 준다. 하지만 **네이티브에 영향을 주는 변경** 후에는 네이티브 프로젝트를 새로 생성해야 한다.

```bash
cd apps/mobile
npx expo prebuild --clean
yarn ios   # 또는 yarn android
```

필요한 경우: 패키지 추가/삭제, `app.config.ts`의 plugins 변경, 네이티브 모듈 설정 변경 등. "빌드는 되는데 새 네이티브 기능이 동작 안 한다" 싶으면 대부분 이 단계를 빼먹은 것이다.

## 다음 단계

앱이 떴다면 이제 코드베이스를 파악할 차례다.

- [explanation/architecture.md](../explanation/architecture.md) — 모노레포 경계, 데이터 흐름, provider stack
- [how-to/ios-build-deploy.md](../how-to/ios-build-deploy.md) / [how-to/android-build-deploy.md](../how-to/android-build-deploy.md) — 배포 런북
- [how-to/ota-update.md](../how-to/ota-update.md) — JS-only 변경의 OTA 발행
- 루트 `CLAUDE.md` — 아키텍처·패턴·주의사항의 최신 SSOT

## 관련 문서

- [docs/README.md](../README.md) — 문서 인덱스 + 작성 규칙
- [explanation/ios-modal-safe-area-provider.md](../explanation/ios-modal-safe-area-provider.md) — 화면 작업 전 알아둘 modal SafeArea 제약
