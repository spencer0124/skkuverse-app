---
title: Bridge Package (@skkuverse/bridge)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
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

- 발신: [apps/webview](../../apps/webview/README.md) 각 페이지
- 수신: apps/mobile의 webview 래퍼 컴포넌트

메시지 타입을 추가할 때는 `types.ts`에 먼저 정의하고 양쪽을 같은 커밋에서 갱신한다.
