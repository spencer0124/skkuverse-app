---
title: Firestore Debugging
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# Firestore Debugging

> 한 줄 요약: "write가 안 먹는다 / 반영이 안 된다" 류의 Firestore 이슈를 오진 없이 좁혀가는 실전 절차 런북. 클라이언트 SDK 관찰 함정 → server truth 직접 조회 → 복제 drift 판정 순으로 진행한다.

> [!NOTE]
> 2026-04-23 FCM preferences↔devices drift 디버깅에서 확립한 기법 3종에, 2026-07 notices picker 유령 상태 포스트모템에서 얻은 증상별 판별법을 합친 문서다.

## 개요

Firestore 디버깅에서 가장 흔한 실수는 **관찰 도구 자체가 거짓말을 하는 걸 모르고 코드부터 의심하는 것**이다. 클라이언트 `onSnapshot`은 옵션에 따라 서버 ack를 숨기고, Firebase Console조차 자체 listener라 stale할 수 있다. 아래 절차는 "관찰 레이어 검증 → server truth 확보 → 원인 국소화" 순서를 강제한다.

## 증상별 진단 판별표 (first-step triage)

코드를 열기 전에 증상 패턴으로 원인 후보를 먼저 좁힌다 (출처: [notices picker 유령 상태 포스트모템](../internal/2026-07-notices-picker-ghost-state.md)).

| 증상 | 판정 | 근거 메커니즘 |
| --- | --- | --- |
| UI에 **잠깐 반영됐다가 revert** | 서버(rules) 거부 | Firestore latency compensation — 로컬 캐시에 낙관적 반영 후 서버 reject 시 롤백. write 코드는 도달했고 rules/payload가 문제 |
| **처음부터 무반응** + write가 `update()` | **대상 문서 부재** | `update()`(patch)는 문서가 없으면 실패하는데, rules 환경에선 `permission-denied`로 관측됨 — 문서 부재를 권한 문제로 위장하는 Firestore 동작 |
| 같은 세션에서 **타 컬렉션 write는 정상** | 인증·App Check 원인 **기각** | 토큰 문제라면 컬렉션을 가리지 않는다. 해당 문서/rules 국소 문제로 좁힌다 |

> [!WARNING]
> `permission-denied`를 보고 곧바로 rules를 의심하지 말 것. 두 번째 행처럼 **문서 부재도 같은 에러 코드로 관측**된다. 먼저 아래 기법 2로 문서 존재 여부를 server truth에서 확인한다.

## 기법 1: onSnapshot은 `includeMetadataChanges` 없이는 서버 ack를 숨긴다

`onSnapshot`을 기본 옵션으로 걸면 **문서 내용이 같은 한 서버 ack / `fromCache` 전환이 emit되지 않는다**. 로컬 낙관적 반영 스냅샷 한 번만 보고 "서버에 안 갔다"고 오진하기 쉽다.

```ts
import { onSnapshot } from '@react-native-firebase/firestore';

// 디버깅 시에는 반드시 metadata 변화까지 구독
const unsubscribe = onSnapshot(
  docRef,
  { includeMetadataChanges: true },
  (snap) => {
    console.log(
      'fromCache:', snap.metadata.fromCache,
      'hasPendingWrites:', snap.metadata.hasPendingWrites,
      'data:', snap.data(),
    );
    // hasPendingWrites: true → false 전환 = 서버 ack 도착
    // fromCache: true → false 전환 = 서버 스냅샷으로 교체됨
  },
);
```

관찰 포인트:

- `hasPendingWrites: true` 스냅샷만 오고 `false` 전환이 안 온다 → write가 서버에 **미도달** (offline 큐잉, App Check 토큰 등)
- `false` 전환이 왔다가 이전 값으로 되돌아간다 → 서버가 **거부** (판별표 첫 행)

## 기법 2: server truth는 Firestore REST API로 직접 조회

Firebase Console도 자체 listener 위에 그려지는 뷰라 **stale할 수 있다**. "서버에 진짜 뭐가 있나"는 Firestore REST API를 직접 때려서 확인한다. 인증은 로컬에 이미 있는 firebase-tools의 refresh_token을 재활용한다.

```bash
# 1) firebase-tools가 저장해둔 refresh_token 추출
REFRESH_TOKEN=$(jq -r '.tokens.refresh_token' ~/.config/configstore/firebase-tools.json)

# 2) access token 교환 — client_id/secret은 firebase-tools의 공개 OAuth 클라이언트
#    (firebase-tools 패키지 소스의 auth 모듈에서 확인)
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="<firebase-tools-oauth-client-id>" \
  -d client_secret="<firebase-tools-oauth-client-secret>" \
  -d refresh_token="$REFRESH_TOKEN" \
  -d grant_type=refresh_token | jq -r '.access_token')

# 3) 문서 직접 조회 — fields와 함께 createTime/updateTime이 내려온다
#    <project-id>는 .firebaserc 또는 `firebase use`로 확인
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/users/<uid>/preferences/main" | jq
```

- 응답이 `404 NOT_FOUND` → 문서 부재 확정 (판별표 두 번째 행의 결정적 증거)
- 응답 문서의 `fields`가 클라이언트 관측과 다르다 → 클라이언트 listener/캐시 레이어 문제로 국소화

## 기법 3: 복제 필드 drift는 두 replica의 `updateTime` 비교

`preferences/main` → `devices/*`처럼 트리거로 미러링되는 복제 필드가 어긋났을 때, "어느 단계가 먼저 죽었나"는 **두 replica 문서의 `updateTime` 비교**로 판정한다 (기법 2의 REST 조회가 `updateTime`을 함께 내려준다).

| 관측 | 판정 |
| --- | --- |
| source `updateTime`이 갱신됨, mirror는 옛날 그대로 | source write는 성공 — **미러링 트리거(CF)가 미발화/실패**한 단계부터 조사 |
| source `updateTime` 자체가 옛날 | **source write부터 미도달** — 클라이언트 write 경로(기법 1)로 회귀 |
| 양쪽 다 최신인데 값이 다름 | 트리거의 필드 매핑/whitelist 로직 버그 |

## Rules 검증은 배포가 아니라 emulator로

> [!WARNING]
> rules 가설을 검증하려고 프로덕션에 배포하지 말 것. 배포는 전 사용자에게 즉시 적용되는 데다, 검증 루프가 느려 오진을 굳힌다. 로컬 emulator 테스트가 검증 수단이다.

```bash
# Firestore rules 테스트 (루트에서 — emulator 자동 기동)
yarn test:rules

# CF 트리거 통합 검증 (functions/)
cd functions && npm run verify:trigger
```

- rules 케이스 추가/수정은 `apps/mobile/firestore.rules.test.mjs`에, 트리거 시나리오는 `functions/scripts/`의 verify 스크립트에 커밋해 재사용한다 (`functions/package.json`의 `verify:*` 스크립트 목록 참조).
- 검증이 green이 된 뒤에만 `firebase deploy --only firestore:rules`.

## 관련 문서

- [2026-07 notices picker 유령 상태 포스트모템](../internal/2026-07-notices-picker-ghost-state.md) — 판별표의 출처가 된 실전 사례
- [FCM 아키텍처](../explanation/fcm-architecture.md) — preferences SSOT / derive 트리거 / 복제 구조
- [docs/README.md](../README.md) — 문서 작성 규칙
