---
title: Add a Notice Tab (Cross-Repo Runbook)
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# 공지 탭 추가 런북 (크로스-레포)

> 새 공지 탭(fixed 또는 picker)을 추가할 때 서버·Cloud Functions·앱에 걸쳐 무엇을 어떤 순서로 고쳐야 하는지의 절차. 탭 추가/제거/이름 변경을 하는 사람이 읽는다.

> [!NOTE]
> 이 작업은 **3개 레포**(skkuverse-crawler → skkuverse-server → skkuverse-app)를 관통한다. 한 레포만 고치면 조용히 깨진다 — 특히 functions 미러 누락은 런타임 에러 없이 "알림 0건 전송"으로 나타난다.

## 개요 — 계약 구조

Source of truth 체인 (상류 → 하류):

| 위치 | 역할 |
| --- | --- |
| `skkuverse-crawler/categories.json` | SSOT — `tabConfig.ts` 헤더 주석 기준 categories.json/sources.json은 crawler가 관리 |
| `skkuverse-server/src/notices/categories.json` | 서버가 실제로 읽는 사본. `tabConfig.ts`가 부팅 시 로드·검증 (`GET /notices/tabs` 응답 + FCM topic 계산의 근거) |
| `skkuverse-app/functions/src/notifications/tabsContract.ts` | **하드코딩 미러** — `FIXED_TAB_KEYS` 5개 + `KNOWN_PICKER_KEYS` 4개. `derive.ts`가 subscribedTopics 파생에 사용 |
| `skkuverse-app` 클라이언트 | 탭 UI는 server-driven (`GET /notices/tabs`)이라 자동 반영. 단 `TabToggleRow.tsx`의 `TAB_EMOJI` 매핑은 하드코딩 (fallback 📌 있음 — cosmetic) |

> [!WARNING]
> `tabsContract.ts` 헤더 주석과 `CLAUDE.md`는 소스 경로를 `skkuverse-server/features/notices/categories.json`으로 적고 있으나, 서버 레포 재구조화로 **실제 경로는 `skkuverse-server/src/notices/categories.json`** 이다 (2026-07-21 확인).

### categories.json 항목 구조 (실측)

```json
{ "id": "academic", "label": { "ko": "학사", "en": "Academic" },
  "tabMode": "fixed", "sourceId": "skku-notice02" }
```

```json
{ "id": "library", "label": { "ko": "도서관", "en": "Library" },
  "tabMode": "picker", "sourceIds": ["lib-hssc", "lib-nsc", "lib-all"],
  "maxSelection": 3, "defaultIds": ["lib-all"],
  "campusDefaultIds": { "hssc": ["lib-hssc"], "nsc": ["lib-nsc"] } }
```

- **fixed**: `sourceId` 하나. 모든 `sourceId`는 같은 폴더의 `sources.json`에 존재해야 함 — 없으면 서버가 부팅 시 fail-fast (`process.exit(1)`).
- **picker**: `sourceIds[]` + `maxSelection` 필수. `defaultIds`·`campusDefaultIds`(키는 `hssc`/`nsc`만)는 선택. per-campus seed(공통 defaults ∪ campus defaults)가 `maxSelection`을 넘으면 검증 실패.

### FCM topic 컨벤션

서버 `notices.topics.ts` `buildTopics()`와 functions `derive.ts`가 **동일 포맷**을 독립적으로 생성한다 (translation layer 없음):

| tabMode | topic 포맷 | 예시 |
| --- | --- | --- |
| fixed | `category:<tab.id>` | `category:academic` |
| picker | `<tab.id>:<sourceId>` | `library:lib-hssc` |

**컨벤션: picker tab key === topic prefix (identity 매핑).** `KNOWN_PICKER_KEYS` 자체가 prefix 집합이며, 별도 prefix 매핑 상수는 폐기됐다. 새 picker 탭의 `id`가 곧 topic prefix가 되므로 다른 이름을 쓸 수 없다.

## 단계 체크리스트

1. **(상류) crawler에 소스/카테고리 정의** — `skkuverse-crawler/categories.json` 갱신 + 새 sourceId면 `sources.json`에 크롤 소스 등록. crawler → server 사본 동기화 방식(수동 복사 vs 스크립트)은 **확인 필요**.

2. **서버 `src/notices/categories.json`에 탭 추가** — 위 구조대로. `sources.json`에 sourceId가 있는지 먼저 확인. 서버는 부팅 시 검증이므로 **redeploy해야 반영**.

3. **같은 release에서 functions 미러 갱신** — `functions/src/notifications/tabsContract.ts`:
   - fixed 탭 → `FIXED_TAB_KEYS`에 추가
   - picker 탭 → `KNOWN_PICKER_KEYS`에 추가
   - 스냅샷 테스트 `functions/test/tabsContract.test.ts`의 expected 리스트와 총 탭 개수 assert도 **의도적으로** 갱신 (이 테스트가 드리프트 안전망)

4. **(필요 시) Android 알림 채널** — `functions/src/channels.ts` `mapCategoryToChannel()`은 일부 카테고리만 전용 채널로 매핑하고 나머지는 `notice_general`로 fallback. 새 fixed 탭에 전용 채널을 주려면 여기와 **앱 쪽 미러 `apps/mobile/src/services/notification-channels.ts`(notifee 사전 등록)를 문자열 동일하게** 함께 갱신. 채널 ID 불일치 시 Android가 조용히 default 채널로 fallback.

5. **검증**

   ```bash
   cd functions
   npm test              # derive + tabsContract 스냅샷 + equality 테스트
   npm run verify:trigger  # firebase emulators:exec 통합 시나리오
   ```

6. **배포 순서 — functions 먼저, 서버 나중 (코드에서 유추한 권장안)**
   - `derive.ts`는 `noticeTabEnabled[key] !== false` default-on 정책이라, 미러가 먼저 배포되면 유저의 다음 preferences write 시점부터 새 topic이 구독에 추가된다 (서버가 아직 그 topic으로 발송 안 하므로 무해).
   - 반대로 서버가 먼저 새 topic으로 발송하면 구독 디바이스 0 → **조용한 미전송**.
   - 단, `onPreferencesWrite` 트리거는 preferences **write 시에만** 재파생한다 — 기존 유저의 `subscribedTopics`가 즉시 갱신되지 않음. 전체 유저 backfill 절차 존재 여부는 **확인 필요** (없으면 새 탭 알림이 활성 유저에게만 점진 전파됨).

## Footgun 표

| Footgun | 증상 | 감지 |
| --- | --- | --- |
| 새 **fixed** key 미러 누락 | topic 미구독 → 해당 탭 알림 0건 전송 | **자체 감지 불가** — derive는 fixed key 목록을 그대로 순회할 뿐. 개발자 조율 + `tabsContract.test.ts` 갱신이 유일한 방어 |
| 새 **picker** key 미러 누락 | 해당 picker 선택이 topic으로 emit 안 됨 | `derive.ts`가 `notifications.derive.unknown_picker_key`를 `logger.warn` → Cloud Logging에서 조기 감지 (fail은 안 함) |
| `sources.json`에 없는 sourceId | 서버 부팅 실패 | fail-fast `exit(1)` — 배포 시 즉시 드러남 (좋은 실패) |
| 채널 매핑 미갱신 | Android에서 `notice_general` 채널로 조용히 fallback | 육안 확인만 |
| picker id ≠ topic prefix로 명명 | topic 계약 파괴 | 컨벤션 위반 — identity 매핑 강제 |
| `pickerSelections.dept[0] === ''` sentinel | (기존 동작) "내 학과 없음" 마커. derive의 falsy 필터가 `dept:` invalid topic 누수 차단 | 필터 로직 건드릴 때만 유의 |
| 'dept' 키 하드코딩 3 sites | dept 탭 rename 시 `notices/index.tsx` 핸들러 + `useAppInit.ts` + `tabsContract.ts` coordinated rename 필요 | 개발자 조율 |

## 관련 문서

- [../explanation/fcm-architecture.md](../explanation/fcm-architecture.md) — derive/trigger/delivery 파이프라인이 왜 이렇게 생겼는지
- [../explanation/notices-feature.md](../explanation/notices-feature.md) — 공지 탭 UI·온보딩 게이트 배경
- `functions/README.md` — verify 스크립트 상세
