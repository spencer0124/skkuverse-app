# iOS Build & Deploy

## Overview

Expo CNG 프로젝트이므로 Xcode 프로젝트가 없음. 빌드는 **EAS Build (--local)**, 업로드는 **Fastlane**으로 분리.

```
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

## Quick Start

```bash
cd apps/mobile

./scripts/ios-build.sh     # .ipa 빌드만
./scripts/ios-beta.sh      # 빌드 + TestFlight 업로드
./scripts/ios-release.sh   # 빌드 + App Store 업로드
```

## How It Works

### 1단계: EAS Build (--local)

```bash
eas build --platform ios --profile production --local --non-interactive --output ./build.ipa
```

- 프로젝트를 `.tar.gz`로 압축 -> 임시 디렉토리에서 빌드
- `.easignore`가 `.gitignore` 대신 적용됨
- `credentials.json`의 로컬 인증서/프로파일 사용
- 출력: `build.ipa`

### 2단계: Fastlane Upload

```bash
bundle exec fastlane ios upload_beta ipa:"./build.ipa"     # TestFlight
bundle exec fastlane ios upload_release ipa:"./build.ipa"   # App Store
```

- App Store Connect API Key로 인증 (AuthKey_VL6TWU5ST5.p8)
- `upload_to_testflight`: TestFlight 업로드 (빌드 처리 대기 skip)
- `deliver`: App Store 업로드 (자동 제출/릴리스 OFF)

## .easignore

EAS 빌드 아카이브 시 `.gitignore` 대신 사용. `.gitignore`와 동일하되 다음 파일은 빌드에 포함:

| 파일 | .gitignore | .easignore | 이유 |
|------|:---:|:---:|------|
| `GoogleService-Info.plist` | 제외 | **포함** | iOS Firebase 설정 |
| `google-services.json` | 제외 | **포함** | Android Firebase 설정 |
| `.env` | 제외 | **포함** | `EXPO_PUBLIC_*` 환경변수 |

## Credentials

| 항목 | 값 |
|------|------|
| Bundle ID | `com.example.skkumap` |
| Apple ID | `spencer0124@naver.com` |
| Team ID | `95HGXTX76L` |
| API Key ID | `VL6TWU5ST5` |
| API Issuer ID | `97e30026-b115-4ce3-8939-a98af36dcf3b` |
| EAS Project ID | `43e326a2-2f25-4317-a341-a107a52c5405` |

## Version Management

- `eas.json`에서 `appVersionSource: "remote"` 설정
- 빌드 번호는 EAS가 원격으로 자동 관리
- `app.config.ts`의 `buildNumber`는 무시됨 (expo-constants manifest에만 남음)

## Simulator

```bash
cd apps/mobile
npx expo run:ios
```

## Troubleshooting

### CocoaPods not found (Fastlane에서 eas build 호출 시)
Fastlane의 Ruby 환경에서 eas build를 호출하면 CocoaPods PATH 문제 발생. 그래서 빌드(쉘)와 업로드(Fastlane)를 분리함.

### GoogleService-Info.plist not found (EAS Build)
`.easignore`가 없거나 해당 파일을 제외하고 있으면 발생. `.easignore`에서 Firebase 파일이 주석 처리(포함)되어 있는지 확인.

### Naver Map key empty
`.env` 파일이 `.easignore`에서 제외되면 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`가 빈 문자열이 됨. `.easignore`에서 `.env`가 포함되는지 확인.
