/**
 * Backend tabs config의 *부분 mirror*.
 * derive 함수가 필요한 최소한만 — fixed category 키 + 알려진 picker 키.
 *
 * Source of truth:
 *   ~/project/skkuverse/skkuverse-server/features/notices/categories.json
 *   (loader: skkuverse-server/features/notices/tabConfig.js)
 *
 * ⚠️ Backend가 새 탭 추가/제거 시 이 파일도 같은 release에서 갱신해야 함.
 *    derive()는 unknown picker key는 logger.warn으로 감지되지만,
 *    fixed key 추가는 자체 감지 불가 — 개발자 조율 책임.
 *
 * Convention: picker tab의 key는 topic prefix와 identity 매핑.
 *   key='dept' → topic 'dept:<id>', key='library' → 'library:<id>', etc.
 *   따라서 prefix 매핑 상수는 불필요 — KNOWN_PICKER_KEYS 자체가 prefix 집합.
 *
 * Sentinel: pickerSelections.dept[0] === '' 은 사용자가 wizard step 2에서
 *   "내 학과가 없어요"로 primary를 명시적으로 건너뛴 상태를 나타냄.
 *   derive() falsy id 필터로 invalid topic emit 차단. 'dept:' 토픽은
 *   FCM v1 API validation에서 reject되므로 누수 시 dispatch 전체 실패.
 */

export const FIXED_TAB_KEYS = [
  'academic',
  'scholarship',
  'career',
  'recruitment',
  'event',
] as const;

export const KNOWN_PICKER_KEYS = [
  'dept',
  'library',
  'dorm',
  'general',
] as const;

export type FixedTabKey = (typeof FIXED_TAB_KEYS)[number];
export type PickerKey = (typeof KNOWN_PICKER_KEYS)[number];

/**
 * Max topics accepted in one `sendNotification` payload — Firestore의 실제
 * `array-contains-any` 한도.
 *
 * Source of truth pair:
 *   skkuverse-server/src/notices/notices.topics.ts `TOPIC_CAP` (항상 같아야 함)
 *   근거: skkuverse-server/docs/decisions/0005-notice-dispatch-content-group.md
 *
 * ⚠️ 서버는 한 글이 N개 게시판에 교차 게시되면 형제들의 topic 을 union 해서
 *    **1회만** 보낸다 — split 하지 않는다. 이 값을 서버의 TOPIC_CAP 보다 낮게
 *    두면 handler 가 그 병합 payload 를 400 으로 거절하고, 서버는 재시도를
 *    소진한 뒤 영구 실패한다 → 교차 게시 공지가 조용히 미발송된다.
 *    올릴 때는 **여기 먼저 배포**하고 그다음 서버를 올린다.
 *
 * handle-notice.ts 가 아니라 이 파일에 두는 이유: 위 탭 키들과 같은 부류의
 * 백엔드 계약 상수이고, 이 모듈은 import 가 없어 계약 테스트가 바로 로드할 수 있다.
 */
export const MAX_TOPICS = 30;
