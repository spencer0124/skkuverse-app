# Android Build & Deploy

## Overview

iOS와 동일하게 Expo CNG 프로젝트. 빌드는 **EAS Build (--local)**, 업로드는 **Fastlane supply**로 분리.

```
apps/mobile/
├── scripts/
│   ├── android-build.sh          # 빌드만
│   ├── android-beta.sh           # 빌드 + GP internal testing
│   └── android-release.sh        # 빌드 + GP production (draft)
├── fastlane/
│   ├── Fastfile                  # android upload_beta, upload_release lane
│   └── play-store-key.json       # Google Play 서비스 계정 키
├── certs/
│   └── upload-keystore.jks       # Upload keystore (Flutter에서 가져옴)
├── credentials.json              # EAS 로컬 인증 설정 (iOS + Android)
├── Gemfile                       # Fastlane 의존성
└── eas.json                      # EAS Build 프로필
```

## Quick Start

```bash
cd apps/mobile

./scripts/android-build.sh     # .aab 빌드만
./scripts/android-beta.sh      # 빌드 + Google Play internal testing 업로드
./scripts/android-release.sh   # 빌드 + Google Play production (draft) 업로드
```

## How It Works

### 1단계: EAS Build (--local)

```bash
eas build --platform android --profile production --local --non-interactive --output ./build.aab
```

- 프로젝트를 `.tar.gz`로 압축 -> 임시 디렉토리에서 빌드
- `credentials.json`의 keystore 정보로 signing config 자동 주입 (CNG이므로 build.gradle 직접 수정 불필요)
- 출력: `build.aab` (Android App Bundle)

### 2단계: Fastlane Upload

```bash
bundle exec fastlane android upload_beta aab:"./build.aab"      # Internal testing
bundle exec fastlane android upload_release aab:"./build.aab"    # Production (draft)
```

- Google Play 서비스 계정 키로 인증 (`play-store-key.json`)
- `upload_beta`: internal track, 즉시 배포 (TestFlight 대응)
- `upload_release`: production track, draft 상태 (수동 배포 필요)

## 빌드 환경 요구사항

빌드 스크립트에서 자동 설정하지만, 수동 빌드 시 확인 필요:

| 항목 | 요구사항 |
|------|----------|
| JDK | 17+ (`/usr/libexec/java_home -v 17`) |
| ANDROID_HOME | `~/Library/Android/sdk` |
| jq | `brew install jq` (version increment에 사용) |

## .easignore

iOS와 동일한 `.easignore` 사용. Firebase 설정 파일은 빌드에 포함:

| 파일 | .gitignore | .easignore | 이유 |
|------|:---:|:---:|------|
| `google-services.json` | 제외 | **포함** | Android Firebase 설정 |
| `.env` | 제외 | **포함** | `EXPO_PUBLIC_*` 환경변수 |

## Credentials

| 항목 | 값 |
|------|------|
| Package Name | `com.zoyoong.skkubus` |
| Keystore | `certs/upload-keystore.jks` (Flutter에서 가져온 동일 키) |
| Key Alias | `upload` |
| EAS Project ID | `43e326a2-2f25-4317-a341-a107a52c5405` |

### Google Play 서비스 계정 키

`fastlane/play-store-key.json` — Google Cloud Console에서 생성한 서비스 계정 JSON 키.

연결 테스트:
```bash
bundle exec fastlane run validate_play_store_json_key json_key:fastlane/play-store-key.json
```

## Version Management

- `eas.json`에서 `appVersionSource: "remote"` 설정
- `autoIncrement`는 `--local` 빌드에서 동작하지 않음
- EAS remote에서 플랫폼별 독립 관리 (iOS buildNumber와 Android versionCode는 별도)
- 초기값: `echo 100 | eas build:version:set -p android`로 설정 (Flutter 마지막 67보다 높게)

## Release Notes (변경사항)

배포 시 Google Play에 표시되는 변경사항. `fastlane/metadata/android/` 아래 locale별 디렉토리에 관리.

```
fastlane/metadata/android/
├── ko-KR/changelogs/default.txt    ← 한국어
├── en-US/changelogs/default.txt    ← 영어
└── zh-CN/changelogs/default.txt    ← 중국어
```

**사용법:** 배포 전에 `default.txt` 파일을 수정하면 업로드 시 자동 포함됨. 수정 안 하면 기존 내용 그대로 올라감.

**글자수 제한:** 최대 500자

## Emulator

```bash
cd apps/mobile
npx expo run:android
```

## Troubleshooting

### JAVA_HOME invalid directory
빌드 스크립트에 `export JAVA_HOME="$(/usr/libexec/java_home -v 17)"` 포함되어 있음. 수동 빌드 시 JDK 17이 설치되어 있는지 확인.

### SDK location not found
빌드 스크립트에 `export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"` 포함. Android SDK가 `~/Library/Android/sdk`에 없으면 직접 경로 지정.

### supply 첫 업로드 실패
Fastlane `supply`는 앱이 Play Console에 최소 1회 수동 업로드된 상태여야 동작. Flutter로 이미 올린 적 있으면 문제없음.

### versionCode 충돌
Flutter 앱의 마지막 versionCode(67)보다 높은 값으로 시작해야 함. `eas build:version:get -p android`로 현재 값 확인 가능.
