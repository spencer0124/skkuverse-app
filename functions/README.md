---
title: Firebase Cloud Functions
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# functions

> Firebase Cloud Functions (2nd gen, asia-northeast3, Node 22) — 클라이언트에 둘 수 없는 서버 로직.

## Functions

| Export | 트리거 | 역할 |
| --- | --- | --- |
| `sendNotification` | HTTP (`X-API-Key`) | 공지 FCM v1 발송 (`handle-notice.ts` 내부 핸들러 경유) |
| `onPreferencesWrite` | Firestore trigger | 알림 intent → `subscribedTopics` derive (SSOT) |
| `syncPreferencesToDevices` | Firestore trigger | preferences 변경을 active devices에 전파 |
| `deleteAccount` | Callable | 계정 + 데이터 완전 삭제 |

## 명령

```bash
npm run build           # tsc
npm run lint
npm test                # derive/tabsContract/equality 유닛 테스트
npm run verify:trigger  # emulators:exec 통합 검증 (4 시나리오)
npm run verify:delete-account
npm run deploy          # firebase deploy --only functions
```

> [!WARNING]
> 트리거/Rules 검증은 배포가 아니라 emulator로 — `verify:*` 스크립트가 정석 경로.

## 주의

`src/notifications/tabsContract.ts`는 skkuverse-server `categories.json`의 하드코딩 미러 — 백엔드 탭 추가 시 같은 release에서 갱신 필수 ([CLAUDE.md](../CLAUDE.md) FCM tabsContract 섹션).
