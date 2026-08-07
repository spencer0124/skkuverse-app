---
title: Bridge Package (@skkuverse/bridge)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-07
audience: internal
---

# packages/bridge

> Web ↔ Native 메시지 패싱 레이어 — webview(SPA)와 모바일 앱 사이의 타입 안전한 통신 계약.

## 구조

| 파일 | 역할 |
| --- | --- |
| `sender.ts` | `postToApp` — web → native 메시지 발신 |
| `receiver.ts` | `parseWebMessage` — native 측 수신/파싱 |
| `types.ts` | 메시지 타입 계약 (양쪽이 공유하는 SSOT) |

## 사용처

- 발신: [skkuverse-web](https://github.com/spencer0124/skkuverse-web) `apps/webview` 각 페이지
- 수신: apps/mobile의 webview 래퍼 컴포넌트

발신 측이 별도 레포로 나갔으므로 `types.ts`는 이제 **레포를 넘는 계약**이다. skkuverse-web이 이 파일을 byte 단위로 vendoring하고, umbrella의 `contracts/manifest.json`에 `bridge.message-types`로 등록돼 소비자 CI에서 해시로 검증된다 ([umbrella ADR 0002](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0002-pull-based-config-contracts.md)).

메시지 타입을 추가할 때는 여기 `types.ts`를 먼저 고친다. 소비자 쪽 복사본을 직접 고치면 그쪽 CI가 빨개지고, 그게 의도된 동작이다.
