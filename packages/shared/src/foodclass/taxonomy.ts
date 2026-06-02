/**
 * 음식 분류 실험 — 라벨 상수
 *
 * 두 축의 라벨 목록. 분류기와 eval 화면 양쪽에서 참조.
 */

/** 요리 종류 6개 */
export const CUISINE_LABELS = ['한식', '중식', '일식', '양식', '분식', '치킨'] as const;
export type CuisineLabel = (typeof CUISINE_LABELS)[number];

/**
 * 음식 카테고리 10개.
 *
 * 데이터셋 cuisine↔category 매핑:
 *   치킨(cuisine)  → 치킨
 *   양식           → 피자 | 버거 | 카페·디저트
 *   분식           → 떡볶이
 *   중식           → 중식면 | 마라탕
 *   일식           → 초밥·회 | 라멘·돈까스
 *   한식           → 족발·보쌈
 */
export const CATEGORY_LABELS = [
  '치킨',
  '피자',
  '버거',
  '떡볶이',
  '중식면',
  '초밥·회',
  '라멘·돈까스',
  '족발·보쌈',
  '마라탕',
  '카페·디저트',
] as const;
export type CategoryLabel = (typeof CATEGORY_LABELS)[number];
