---
title: Local EAS Build + Fastlane over EAS Cloud
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# 0003. EAS 클라우드 대신 로컬 빌드 + Fastlane

## Status

Accepted — 빌드 파이프라인 구축 시 결정 (정확한 시점 기록 없음, 2026-07-21 백필 기록)

## Context

Expo 앱의 스토어 빌드·배포 경로로 (a) EAS 클라우드 빌드, (b) `eas build --local` + Fastlane 업로드 두 가지가 있었다. 클라우드 빌드는 크레딧 비용이 들고, 빌드 환경(캐시·툴체인·시크릿 주입)에 대한 제어가 제한된다. 솔로 개발 환경에서는 로컬 macOS 머신이 항상 가용하다.

## Decision

**EAS Build `--local` + Fastlane으로 전부 로컬에서 빌드·배포한다.** EAS 클라우드 빌드는 쓰지 않는다.

- 진입점은 `apps/mobile/scripts/{ios,android}-{build,beta,release}.sh`.
- 인증은 `credentials.json` 로컬 관리 (iOS dist.p12 + mobileprovision, Android upload-keystore.jks) + `eas.json` production 프로필에 `"credentialsSource": "local"`.
- 업로드는 Fastlane (TestFlight / App Store / Play internal / Play production draft), 릴리즈 노트는 `fastlane/metadata/` locale별 파일.

## Consequences

- (+) 빌드 비용 0, 빌드 환경 완전 제어, 클라우드 큐 대기 없음.
- (+) `autoIncrement: true`가 `--local`에서도 동작 — 버전 관리는 EAS remote version으로 유지.
- (−) **`.easignore` 관리 부담**: `.gitignore` 대신 적용되므로 Firebase 설정·`.env`·`certs/certificate.pem`이 빌드에 *포함되도록* 유지해야 한다 (실수로 제외되면 빌드 산출물이 조용히 깨짐).
- (−) 클라우드가 자동 주입하는 `expo-channel-name`이 없다 — `app.config.ts`의 `updates.requestHeaders`에 수동 설정 필수.
- (−) **monorepo 함정**: EAS 로컬 샌드박스에서 embed 번들이 `ARCHIVE FAILED`로 깨지는 조합이 있다. `eas.json`에 `EXPO_NO_METRO_WORKSPACE_ROOT=1` + iOS 스크립트에 심볼릭 없는 `TMPDIR` 필수 — 상세는 [../how-to/ios-build-deploy.md](../how-to/ios-build-deploy.md) Troubleshooting.
- (−) 빌드 재현성이 로컬 머신 상태에 의존 — 머신 교체 시 JDK 17, `ANDROID_HOME`, 인증서 셋업을 다시 해야 한다.
