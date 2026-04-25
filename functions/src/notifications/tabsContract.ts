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
