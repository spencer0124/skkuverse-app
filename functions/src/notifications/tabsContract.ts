/**
 * Backend tabs config의 *부분 mirror*.
 * derive 함수가 필요한 최소한만 — fixed category 키 + 알려진 picker 키.
 *
 * Source of truth:
 *   ~/project/skkuverse/skkuverse-server/src/notices/categories.json
 *   (loader: skkuverse-server/src/notices/tabConfig.ts)
 *   탭 추가 절차: docs/how-to/add-notice-tab.md
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
