---
title: FCM Notifications Architecture
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# FCM Notifications Architecture

> 한 줄 요약: 스꾸버스 푸시 알림(FCM)의 현행 아키텍처 — v5 SSOT("기록은 의도, 전송은 파생"), tabsContract 미러, drift sync, delivery path, auth transition을 다룬다. FCM 관련 코드를 만지기 전에 읽는다.

> [!NOTE]
> This document supersedes [`docs/plans/fcm-push-notifications.md`](../plans/fcm-push-notifications.md), which is now a short record that the work happened. This file is the SSOT for the current architecture. The troubleshooting history that used to live only in the plan was moved out before it was retired: see [`internal/2026-04-fcm-preferences-devices-drift.md`](../internal/2026-04-fcm-preferences-devices-drift.md), [`app-check.md`](app-check.md), and [`how-to/firestore-debugging.md`](../how-to/firestore-debugging.md).

## 개요

- **스택:** FCM 직접 사용 (`@react-native-firebase/messaging`) + 로컬 표시/뱃지는 `@notifee/react-native`.
- **진행 상태:** Phase 1~4 (토큰·딥링크·뱃지·delivery CF) + Phase 5 SSOT (2026-04-25) 완료. `onboardedAt` 필드는 2026-04-28 추가.
- **옵션 D — 알림함 없음:** 유저별 알림 레코드(in-app inbox)를 만들지 않는다. 공지 탭이 풀 히스토리를 제공하므로 푸시는 fire-and-forget, 미확인 가시성은 앱 아이콘 뱃지(OS) + 탭바 뱃지(앱 내)로 확보 — 둘 다 로컬 카운터(Zustand + Notifee). 결정 배경은 [ADR 0002](../decisions/0002-no-notification-inbox.md) 참조.
- **임시 진단 화면:** `apps/mobile/app/debug-fcm.tsx` — 캠퍼스 탭 우상단 빨간 "FCM" 버튼으로 진입. dogfooding 안정 후 제거 예정.
- **데이터 저장 원칙:** 유저 데이터(디바이스, preferences)는 Firebase(Firestore/Auth), 공공 데이터(공지 본문 등)는 MongoDB(백엔드 API 경유).

## 원칙 — "기록은 의도, 전송은 파생" (v5 SSOT)

클라이언트는 **의도(intent)만 기록**하고, 실제 전송 대상(topic)은 서버(Cloud Function)가 **파생**한다. Firestore `users/{uid}/preferences/main` 문서가 단일 진실 출처.

### 클라이언트가 쓰는 intent 필드

클라이언트는 아래 필드만 쓴다 (스키마 권위: `apps/mobile/src/services/firestore-notifications.ts`):

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `enabled` | `boolean` | 마스터 토글 |
| `categoryEnabled` | `{ essential, services, notices }` | 카테고리별 토글 |
| `noticeTabEnabled` | `Record<string, boolean>` | 공지 탭별 토글 |
| `pickerSelections` | `Record<string, string[]>` | picker 탭(학과 등) 선택 목록 |
| `onboardedAt` | `Timestamp \| null` | 온보딩 완료 discriminator (아래 참조) |

### 파생 (CF `onPreferencesWrite`)

- 트리거: `users/{uid}/preferences/main` onWrite — 2nd gen, `asia-northeast3`, Node 22 (`functions/src/triggers/onPreferencesWrite.ts`).
- intent에서 `subscribedTopics` + `derivedAt`을 derive해 같은 문서에 write (`functions/src/notifications/derive.ts`).
- **`onboardedAt`은 derive 입력이 아니다** — Guard 1의 intent 비교 4 필드(`enabled`/`categoryEnabled`/`noticeTabEnabled`/`pickerSelections`)에 포함되지 않는다.
- **Trigger guard 두 겹:** ① intent unchanged → skip (자기 write로 인한 self-loop 차단) ② derived 결과가 기존과 equal → skip (idempotent write 생략).

### Firestore Rules의 역할

- **derived 필드(`subscribedTopics`, `derivedAt`) client write 봉쇄** — 클라이언트는 intent만 만질 수 있다.
- **`onboardedAt` 단방향 immutability:** 'null → timestamp' 한 방향만 허용. 시드 후 재변경은 reject. 테스트 케이스는 `apps/mobile/firestore.rules.test.mjs`에 있다.
- Rules 정의: `apps/mobile/firestore.rules` (배포: `firebase deploy --only firestore:rules`).

### 클라이언트 write API 4종

전부 `apps/mobile/src/services/firestore-notifications.ts`:

| API | 대상 필드 |
| --- | --- |
| `setMasterEnabled` | `enabled` |
| `setCategoryEnabled` | `categoryEnabled.<key>` |
| `setNoticeTabEnabled` | `noticeTabEnabled.<key>` |
| `setPickerSelectionRemote` | `pickerSelections.<key>` |

**전부 단일 dot-path `updateDoc`이고 트랜잭션이 없다.** 이유: 캠퍼스 wifi dead spot에서 Firestore SDK의 offline write 큐잉이 동작하도록 보호하기 위함 — 트랜잭션은 offline에서 즉시 실패한다.

### `onboardedAt` discriminator

- `seedOnboardingPreferences`가 온보딩 wizard 완료 시 `onboardedAt: serverTimestamp()`로 시드.
- `initializeFirestoreNotifications`의 default doc은 `onboardedAt: null`.
- 두 번째 기기 로그인 시 `onboardedAt != null`을 자동복원(온보딩 게이트 해제) discriminator로 사용 — 상세는 루트 `CLAUDE.md`의 Notices "Onboarding gate + 자동복원" 섹션 참조.

### MMKV vs Firestore 경계

| 저장소 | 내용 |
| --- | --- |
| MMKV (device-local) | `token`, `deviceId`, `unreadCount` — 기기 국소 상태만 persist |
| Firestore | `preferences` — onSnapshot listener가 단일 source, 로컬 복제본을 SSOT로 삼지 않음 |

## tabsContract — 서버 탭 key 미러

`functions/src/notifications/tabsContract.ts`에 공지 탭 key를 하드코딩으로 미러한다. 작성 시점 기준 fixed 탭(`academic`/`scholarship`/`career`/`recruitment`/`event`)과 picker 탭(`dept`/`library`/`dorm`/`general`)으로 구성되며, **현행 목록의 권위는 파일 자체다.**

- **Source of truth는 별도 레포:** `~/project/skkuverse/skkuverse-server/features/notices/categories.json`. 백엔드가 새 탭을 추가하면 **같은 release에서** 이 미러를 갱신해야 한다.
- derive는 unknown **picker** key를 `logger.warn`으로 감지하지만, unknown **fixed** key는 자체 감지 불가 — 개발자 간 조율에 의존한다.
- **컨벤션: picker tab key === topic prefix** (identity 매핑). 과거의 `pickerPrefixForTabKey` 변환 함수는 폐기됐다.

## Drift sync — `syncPreferencesToDevices`

preferences와 devices 복제 필드의 drift를 막는 Cloud Function (2026-04-23 해결).

| 항목 | 값 |
| --- | --- |
| 트리거 | `users/{uid}/preferences/main` onWrite |
| 런타임 | 2nd gen, `asia-northeast3`, Node 22 |
| 동작 | 해당 uid의 active devices 전부에 **`subscribedTopics` + `notificationsEnabled` 두 필드만** whitelist update |
| 실측 latency | 약 0.3초 |
| 설정 | `retry: true` + 10분 event age guard + `maxInstances: 10` |
| 비교 | before/after diff Set 비교로 불필요 write 생략 |
| 권한 | Admin SDK (Security Rules 우회) |
| 구현 | `functions/src/sync-preferences-to-devices.ts` |

For why each of this trigger's guards exists, and the incident that produced it, see [`internal/2026-04-fcm-preferences-devices-drift.md`](../internal/2026-04-fcm-preferences-devices-drift.md).

## Delivery path — `sendNotification`

백엔드(Node 서버)가 공지 발행 시 호출하는 범용 HTTP 진입점 (Phase 4, 2026-04-23 배포 완료).

- **구성:** `sendNotification` HTTP CF (2nd gen, `asia-northeast3`, Node 22) + `handleNoticeNotification` internal handler.
- **Endpoint:** `https://asia-northeast3-skkubus-95723.cloudfunctions.net/sendNotification`
- **인증:** `X-API-Key` 헤더 vs Secret Manager `FCM_API_KEY` — `defineSecret` 바인딩 + `timingSafeEqual` 비교 + **`.trim()` 방어** (secret 값 끝 개행 대비).
- **devices 쿼리:** composite index 필수 — `apps/mobile/firestore.indexes.json` (`active` + `notificationsEnabled` + `subscribedTopics`).
- **페이로드:** FCM `data`는 `Record<string, string>`으로 빌드 — optional `undefined` 필드는 제외 (FCM v1 API validation 보호). 백엔드와 공유하는 payload 계약(`NoticeNotificationPayload`)은 별도 레포에 있다.
- **구조화 로깅:** `logger.info('notice.dispatch.complete', { noticeId, topics, deviceCount, sent, failed, cleanedUp, durationMs })` → Cloud Logging에서 `jsonPayload.noticeId="..."` 필터로 추적.
- **구현:** `functions/src/send-notification.ts`, `functions/src/handle-notice.ts`, `functions/src/channels.ts`, `functions/src/types.ts`.

### Token cleanup 정책 (critical)

`TOKEN_CLEANUP_CODES` allowlist에는 **두 코드만** 포함한다:

- `messaging/registration-token-not-registered`
- `messaging/invalid-registration-token`

`messaging/invalid-argument`는 **의도적으로 제외** — 이 에러는 token이 아니라 payload 전체의 문제일 수 있어서, allowlist에 넣으면 잘못된 payload 한 번에 healthy device 수백 개를 `active: false`로 꺼버리는 footgun이 된다.

## Auth transition — anon↔Google uid 전환

anon↔Google 전환 시 `devices/{deviceId}.uid`가 stale해져 `firestore/permission-denied`가 나던 버그의 해법 (Task #12 + 2026-04-25 보강).

- **감지·재실행:** `apps/mobile/src/hooks/useAppInit.ts`의 `onAuthStateChanged`가 `authStore.lastKnownUid`로 uid 전환을 감지하면 `initializeFirestoreNotifications()` 재실행. `withRetry` closure는 uid를 `getAuth().currentUser?.uid`로 lazy resolve — retry 도중 uid가 또 바뀌어도 race-safe.
- **Sign-out:** `signOutFromGoogle`(`apps/mobile/src/services/google-auth.ts`)은 sign-out **전에** `unregisterDevice(deviceId)`로 문서를 `active: false` 처리.
- **anon→Google 미러 (2026-04-25 보강):** `OnboardingScreen.handleSignIn`과 `apps/mobile/app/login.tsx`의 `handleSignIn` 양쪽에 동일 패턴 — sign-in **전** `unregisterDevice` + sign-in **후** `await initializeFirestoreNotifications`. rule의 claim 경로(아래 path b)를 통과시키고 초기화 race를 차단한다.
- **Rule 시맨틱:** devices 문서는 "**active 문서는 owner만, inactive 문서는 아무 authed user나 claim 가능**". 보안 트레이드오프 설명은 `apps/mobile/firestore.rules`의 SECURITY TRADE 주석, 케이스는 `apps/mobile/firestore.rules.test.mjs` 참조. Rules는 `skkubus-95723` production에 배포 완료.

## 검증 경로

| 대상 | 명령 | 비고 |
| --- | --- | --- |
| derive 트리거 통합 검증 | `cd functions && npm run verify:trigger` | `firebase emulators:exec` 기반. 시나리오 정의는 `functions/scripts/verify-trigger.ts`가 권위 |
| Firestore Rules | `yarn test:rules` (루트) | Firestore emulator + `node --test`. 케이스 목록은 `apps/mobile/firestore.rules.test.mjs`가 권위 |

> [!WARNING]
> 트리거·Rules 검증에 실배포를 쓰지 않는다 — emulator 경로가 원칙. 배포는 검증이 green인 뒤에.

## 구현 파일 색인

| 역할 | 경로 |
| --- | --- |
| 탭 key 미러 + derive | `functions/src/notifications/tabsContract.ts`, `functions/src/notifications/derive.ts` |
| derive 트리거 | `functions/src/triggers/onPreferencesWrite.ts` |
| drift sync | `functions/src/sync-preferences-to-devices.ts` |
| delivery | `functions/src/send-notification.ts`, `functions/src/handle-notice.ts`, `functions/src/channels.ts`, `functions/src/types.ts` |
| 클라 Firestore 레이어 | `apps/mobile/src/services/firestore-notifications.ts` |
| 알림 설정 UI | `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` |
| auth transition | `apps/mobile/src/hooks/useAppInit.ts`, `apps/mobile/src/services/google-auth.ts`, `apps/mobile/app/login.tsx` |
| Rules + 테스트 + index | `apps/mobile/firestore.rules`, `apps/mobile/firestore.rules.test.mjs`, `apps/mobile/firestore.indexes.json` |
| 검증 스크립트 | `functions/scripts/verify-trigger.ts` |
| 진단 화면 (임시) | `apps/mobile/app/debug-fcm.tsx` |

## 관련 문서

- [internal/2026-04-fcm-preferences-devices-drift.md](../internal/2026-04-fcm-preferences-devices-drift.md) — why preferences replicate to devices through a trigger, and how to operate it
- [plans/fcm-push-notifications.md](../plans/fcm-push-notifications.md) — the superseded implementation plan, kept as a record
- [app-check.md](app-check.md) — Firestore write 앞의 App Check 토큰 준비 (`primeAppCheck`)
- [internal/2026-07-notices-picker-ghost-state.md](../internal/2026-07-notices-picker-ghost-state.md) — 유령 preferences 포스트모템 (시드 write 실패 사고)
- [ADR 0002 — 알림함 없는 푸시 설계](../decisions/0002-no-notification-inbox.md)
