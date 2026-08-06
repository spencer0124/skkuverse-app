/**
 * Backend tabs config의 *부분 mirror*.
 * derive 함수가 필요한 최소한만 — fixed category 키 + 알려진 picker 키.
 *
 * 이 파일은 **두 개의 서로 반대 방향 계약**을 담는다:
 *
 *   탭 키    crawler → app   (이 레포가 하류. 생성된다)
 *   MAX_TOPICS  app → server (이 레포가 상류. 손으로 소유한다)
 *
 * 그래서 키만 `./tabsContract.generated.ts` 로 분리했다. 전체를 생성하면
 * MAX_TOPICS 의 출처를 지어내야 하는데, 그건 Firestore 한도에 묶인 앱 쪽
 * 결정이지 crawler 가 정하는 값이 아니다.
 *
 * import 표면은 그대로다 — derive.ts / handle-notice.ts / 테스트 모두
 * 계속 이 파일에서 가져온다.
 *
 * 탭 추가/제거 절차: crawler 의 categories.json 을 고치고
 *   python3 <skkuverse>/exported/sync_contracts.py pull --repo app
 * 을 돌린다. 빠뜨리면 `.contracts.lock.json` 해시 불일치로 CI 가 막는다 —
 * 예전처럼 "알림 0건 전송, 에러 없음" 으로 조용히 새지 않는다.
 * 계약 정의: skkuverse/contracts/manifest.json 의 `notices.tab-keys`.
 *
 * Convention: picker tab의 key는 topic prefix와 identity 매핑.
 *   key='dept' → topic 'dept:<id>', key='library' → 'library:<id>', etc.
 *   따라서 prefix 매핑 상수는 불필요 — KNOWN_PICKER_KEYS 자체가 prefix 집합.
 *   생성기가 각 key 를 `^[a-z][a-z0-9]*$` 로 검증한다 — ':' 가 들어간 key 는
 *   그 key 가 만드는 모든 topic 문자열을 망가뜨린다.
 *
 * Sentinel: pickerSelections.dept[0] === '' 은 사용자가 wizard step 2에서
 *   "내 학과가 없어요"로 primary를 명시적으로 건너뛴 상태를 나타냄.
 *   derive() falsy id 필터로 invalid topic emit 차단. 'dept:' 토픽은
 *   FCM v1 API validation에서 reject되므로 누수 시 dispatch 전체 실패.
 */

import {
  FIXED_TAB_KEYS as GENERATED_FIXED_TAB_KEYS,
  KNOWN_PICKER_KEYS as GENERATED_KNOWN_PICKER_KEYS,
} from './tabsContract.generated.ts';

export const FIXED_TAB_KEYS = GENERATED_FIXED_TAB_KEYS;
export const KNOWN_PICKER_KEYS = GENERATED_KNOWN_PICKER_KEYS;

export type FixedTabKey = (typeof FIXED_TAB_KEYS)[number];
export type PickerKey = (typeof KNOWN_PICKER_KEYS)[number];

/**
 * Max topics accepted in one `sendNotification` payload — Firestore의 실제
 * `array-contains-any` 한도.
 *
 * **생성되지 않는다. 이 레포가 소유한다.** 서버의 TOPIC_CAP 이 지켜야 할
 * 천장이고, 방향이 있는 계약이다:
 *
 *   skkuverse-server `TOPIC_CAP` **<=** 이 값
 *
 * (같아야 하는 게 아니라 이하여야 한다 — 그래야 ADR 0005 가 강제하는
 *  배포 순서, 즉 "앱 먼저" 의 중간 상태가 초록이다. 계약 정의:
 *  skkuverse/contracts/manifest.json 의 `notices.topic-cap`, relation `lte`.)
 *
 * ⚠️ 서버는 한 글이 N개 게시판에 교차 게시되면 형제들의 topic 을 union 해서
 *    **1회만** 보낸다 — split 하지 않는다. 이 값을 서버의 TOPIC_CAP 보다 낮게
 *    두면 handler 가 그 병합 payload 를 400 으로 거절하고, 서버는 재시도를
 *    소진한 뒤 영구 실패한다 → 교차 게시 공지가 조용히 미발송된다.
 *    올릴 때는 **여기 먼저 배포**하고 그다음 서버를 올린다.
 *    근거: skkuverse-server/docs/decisions/0005-notice-dispatch-content-group.md
 */
export const MAX_TOPICS = 30;
