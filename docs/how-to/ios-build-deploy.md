---
title: iOS Build & Deploy
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# iOS Build & Deploy

> iOS 앱을 로컬에서 빌드(EAS Build `--local`)하고 TestFlight/App Store에 배포(Fastlane)하는 절차 런북. iOS 배포를 실행하는 사람이 읽는다.

## 개요

Expo CNG 프로젝트이므로 Xcode 프로젝트가 레포에 없다. 빌드는 **EAS Build (`--local`)**, 업로드는 **Fastlane**으로 분리되어 있다 (Fastlane의 Ruby 환경에서 eas build를 호출하면 CocoaPods PATH 문제가 발생하기 때문 — 트러블슈팅 참조). EAS 클라우드 빌드는 사용하지 않는다.

```text
apps/mobile/
├── scripts/
│   ├── ios-build.sh          # 빌드만
│   ├── ios-beta.sh           # 빌드 + TestFlight
│   └── ios-release.sh        # 빌드 + App Store
├── fastlane/
│   ├── Fastfile              # upload_beta, upload_release lane
│   ├── Appfile               # app_identifier, apple_id, team_id
│   └── AuthKey_VL6TWU5ST5.p8 # App Store Connect API Key
├── certs/
│   ├── dist.p12              # Distribution Certificate
│   └── dist.mobileprovision  # Provisioning Profile
├── credentials.json          # EAS 로컬 인증 설정
├── Gemfile                   # Fastlane 의존성
└── eas.json                  # EAS Build 프로필
```

> [!NOTE]
> 시뮬레이터 개발 실행은 배포 파이프라인과 무관하게 `cd apps/mobile && npx expo run:ios`.

## 사전 준비

### Credentials

| 항목 | 값 |
| --- | --- |
| Bundle ID | `com.example.skkumap` |
| Apple ID | `spencer0124@naver.com` |
| Team ID | `95HGXTX76L` |
| API Key ID | `VL6TWU5ST5` |
| API Issuer ID | `97e30026-b115-4ce3-8939-a98af36dcf3b` |
| EAS Project ID | `43e326a2-2f25-4317-a341-a107a52c5405` |

- `credentials.json`에 로컬 인증서(`certs/dist.p12`)와 프로비저닝 프로파일(`certs/dist.mobileprovision`) 경로가 설정되어 있어야 한다.
- Fastlane 업로드 인증은 App Store Connect API Key(`fastlane/AuthKey_VL6TWU5ST5.p8`)로 한다.

### .easignore

EAS 빌드 아카이브 시 `.gitignore` 대신 `.easignore`가 적용된다. `.gitignore`와 동일하되 다음 파일은 빌드에 포함되어야 한다:

| 파일 | .gitignore | .easignore | 이유 |
| --- | :---: | :---: | --- |
| `GoogleService-Info.plist` | 제외 | **포함** | iOS Firebase 설정 |
| `google-services.json` | 제외 | **포함** | Android Firebase 설정 |
| `.env` | 제외 | **포함** | `EXPO_PUBLIC_*` 환경변수 |

### EAS 로컬 빌드 monorepo 필수 설정

둘 다 없으면 embed 번들 단계에서 `ARCHIVE FAILED`가 난다 (자세한 메커니즘은 트러블슈팅의 ARCHIVE FAILED 항목 참조):

1. `eas.json`의 beta/production 프로필 env에 `EXPO_NO_METRO_WORKSPACE_ROOT=1`
2. 빌드 스크립트(`scripts/ios-{beta,build,release}.sh`)의 `export TMPDIR="$HOME/.eas-build-tmp"` (심볼릭 링크 없는 경로)

### 버전 관리 (자동 — 알아만 두기)

- `eas.json`에서 `appVersionSource: "remote"` 설정 — EAS 서버에서 빌드 번호 관리
- `autoIncrement: true`가 beta/production 프로필 모두에 설정됨 — `--local` 빌드에서도 동작 확인
- 빌드 시 EAS가 자동으로 현재 번호 +1 증가 후 빌드 (수동 관리 불필요)
- `app.config.ts`의 `buildNumber`는 무시됨 (expo-constants manifest에만 남음)
- 현재 번호 확인:

  ```bash
  eas build:version:get -p ios --non-interactive --json
  ```

## 단계

1. **Release Notes 수정** — 배포 시 App Store / TestFlight에 표시되는 변경사항. `fastlane/metadata/ios/` 아래 locale별 파일을 수정하면 업로드 시 자동 포함된다. 수정 안 하면 기존 내용 그대로 올라간다. 최대 4000자.

   ```text
   fastlane/metadata/ios/
   ├── ko/release_notes.txt        ← 한국어
   ├── en-US/release_notes.txt     ← 영어
   └── zh-Hans/release_notes.txt   ← 중국어(간체)
   ```

   - `upload_release`: 3개 언어 모두 App Store에 업로드 (`release_notes` hash 파라미터)
   - `upload_beta`: 한국어만 TestFlight "테스트할 내용"에 표시 (`changelog` 파라미터)

2. **빌드 + 업로드 스크립트 실행**

   ```bash
   cd apps/mobile

   ./scripts/ios-build.sh     # .ipa 빌드만
   ./scripts/ios-beta.sh      # 빌드 + TestFlight 업로드
   ./scripts/ios-release.sh   # 빌드 + App Store 업로드
   ```

   스크립트 내부는 2단계로 동작한다.

   **1단계 — EAS Build (`--local`):**

   ```bash
   eas build --platform ios --profile production --local --non-interactive --output ./build.ipa
   ```

   - 프로젝트를 `.tar.gz`로 압축 → 임시 디렉토리에서 빌드
   - `.easignore`가 `.gitignore` 대신 적용됨
   - `credentials.json`의 로컬 인증서/프로파일 사용
   - 출력: `build.ipa`

   **2단계 — Fastlane Upload:**

   ```bash
   bundle exec fastlane ios upload_beta ipa:"./build.ipa"      # TestFlight
   bundle exec fastlane ios upload_release ipa:"./build.ipa"   # App Store
   ```

   - App Store Connect API Key로 인증 (`AuthKey_VL6TWU5ST5.p8`)
   - `upload_to_testflight`: TestFlight 업로드 (빌드 처리 대기 skip)
   - `deliver`: App Store 업로드 (자동 제출/릴리스 OFF, `ignore_language_directory_validation: true`, `precheck_include_in_app_purchases: false`)

## 트러블슈팅

### CocoaPods not found (Fastlane에서 eas build 호출 시)

Fastlane의 Ruby 환경에서 eas build를 호출하면 CocoaPods PATH 문제 발생. 그래서 빌드(쉘)와 업로드(Fastlane)를 분리함.

### GoogleService-Info.plist not found (EAS Build)

`.easignore`가 없거나 해당 파일을 제외하고 있으면 발생. `.easignore`에서 Firebase 파일이 주석 처리(포함)되어 있는지 확인.

### Naver Map key empty

`.env` 파일이 `.easignore`에서 제외되면 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`가 빈 문자열이 됨. `.easignore`에서 `.env`가 포함되는지 확인.

### ARCHIVE FAILED — "Unable to resolve module .../apps/mobile/index.ts" (Metro embed 번들)

**증상:** 네이티브 컴파일/링킹은 다 통과하는데 Xcode "Bundle React Native code and images" 스크립트 페이즈에서
`Unable to resolve module .../apps/mobile/index.ts from .../build/.` → `** ARCHIVE FAILED **`.

**원인은 독립적인 2개이고 둘 다 고쳐야 함** (하나만 고치면 에러 경로만 바뀌고 계속 실패):

1. **@expo/cli의 Metro workspace-root 기본값**: 최근 @expo/cli가 `EXPO_USE_METRO_WORKSPACE_ROOT`를 **기본 ON**으로 바꿈 (`@expo/config/build/paths/env.js`). EAS 샌드박스는 `yarn --frozen-lockfile`이 nested `apps/mobile/node_modules`를 만들어(로컬 repo는 완전 호이스팅이라 이게 없음) workspace-root 탐지를 발동 → Metro 서버 루트가 monorepo 루트(`build/`)가 되고, `tsconfig.json` paths(`@/* → ./src/*`)·엔트리를 못 찾음. → **`eas.json` build env에 `EXPO_NO_METRO_WORKSPACE_ROOT=1`** (켜는 변수 `EXPO_USE_...=1`은 이미 기본 ON이라 no-op). 서버 루트가 `build/`→`build/apps/mobile`로 바뀌면 이 단계 통과.

2. **macOS 심볼릭 경로 불일치**: (1) 해결 후엔 엔트리 경로는 심볼릭 형태(`/tmp/...`), Metro 서버 루트는 realpath(`/private/tmp/...`)라 metro가 같은 디렉토리를 다른 경로로 보고 매칭 실패. `/tmp→/private/tmp`, `/var/folders→/private/var/folders` 모두 심볼릭이라 일반 터미널에서도 발생. → **빌드 스크립트가 `export TMPDIR="$HOME/.eas-build-tmp"`로 심볼릭 없는 경로에서 빌드** (`scripts/ios-{beta,build,release}.sh`에 적용됨).

**디버깅 팁:** 이 실패는 **로컬 repo에선 재현 안 됨**(완전 호이스팅). 추측으로 12분짜리 풀빌드 반복하지 말 것. 빌드 *도중* 살아있는 EAS 샌드박스(`$TMPDIR/eas-build-local-nodejs/*/build/apps/mobile`)에 들어가 직접 `expo export:embed`를 돌려 재현 — CWD/projectRoot가 apps/mobile면 5825 modules ✓, monorepo 루트면 깨짐.

## 관련 문서

- [android-build-deploy.md](../how-to/android-build-deploy.md) — 동일 파이프라인의 Android 판
- [ota-update.md](../how-to/ota-update.md) — 빌드 채널(beta/production)과 연동되는 OTA 발행
- [docs/README.md](../README.md) — 문서 작성 규칙
