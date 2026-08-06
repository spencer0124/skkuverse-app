---
title: Self-Hosted OTA with Fixed-String runtimeVersion
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# 0004. 셀프호스팅 expo-open-ota + 고정 문자열 runtimeVersion

## Status

Accepted — OTA 인프라 구축 시 결정 (정확한 시점 기록 없음, 2026-07-21 백필 기록). eoas 버전 고정은 2026-07 (커밋 54153d9).

## Context

JS-only 변경을 스토어 심사 없이 배포하기 위해 OTA 업데이트가 필요했다. EAS Update(클라우드) 대신 셀프호스팅을 택한 상태에서, 두 가지 하위 결정이 있었다:

1. **runtimeVersion 정책** — Expo의 fingerprint 방식(네이티브 코드 해시 자동 계산) vs 고정 문자열 수동 관리. fingerprint는 EAS build와 eoas(expo-open-ota CLI) 간 해시 **불일치 이슈**가 있어 같은 네이티브 빌드가 서로 다른 runtime으로 계산되는 문제가 있었다.
2. **eoas CLI 버전** — 미고정 `npx eoas`는 메이저 점프를 그대로 타서 배포 스크립트가 예고 없이 깨질 수 있다 (실제 사고 → 커밋 54153d9).

## Decision

- **셀프호스팅 expo-open-ota 서버** (`https://ota.skkuverse.com`)를 쓴다.
- **runtimeVersion은 고정 문자열** (실제 값은 `apps/mobile/app.config.ts`에서 확인). fingerprint 방식은 쓰지 않는다.
- **채널 분리**: `*-beta.sh` 빌드 → "beta" 채널, `*-release.sh` 빌드 → "production" 채널. `EAS_BUILD_PROFILE` 환경변수로 `app.config.ts`가 채널 자동 결정. 워크플로우는 beta OTA → 검증 → production OTA.
- **네이티브 변경 시 runtimeVersion 수동 bump 규율**: 새 네이티브 모듈·SDK 업그레이드·plugins 변경이면 반드시 bump. bump는 명시적 유저 지시로만 (자동 bump 금지).
- **eoas 버전 고정** (커밋 54153d9, 고정 값은 해당 스크립트에서 확인) — 미고정 npx의 메이저 점프 사고 방지.

## Consequences

- (+) OTA 서버·채널을 완전 제어, EAS Update 종속·비용 없음.
- (+) 고정 문자열이라 "이 빌드가 어떤 runtime인가"가 결정적 — fingerprint 불일치로 인한 업데이트 미수신/오수신 클래스 제거.
- (−) **수동 bump 규율이 유일한 방어선**: 네이티브 모듈을 추가하고 bump를 잊으면, 새 JS를 구버전 네이티브 바이너리가 받아 hard-import 시점에 **크래시**할 수 있다. 리스크는 사람이 진다 — 네이티브 변경 PR 리뷰 시 bump 여부를 반드시 확인.
- (−) 셀프호스팅 서버 운영 부담 (가용성·인증 `EXPO_TOKEN` 관리는 `.env.ota.local`).
- eoas 고정 버전은 SDK 업그레이드 시 재검토 필요 (호환 범위 이동).

관련: [../how-to/ota-update.md](../how-to/ota-update.md).
