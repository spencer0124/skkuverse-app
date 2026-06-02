/**
 * 음식 분류 실험 — 공유 타입
 *
 * EmbedFn을 주입 인터페이스로 사용해 분류 로직을 네이티브(Apple NLContextualEmbedding)에서
 * 분리한다. 순수 로직은 vitest로 검증하고, 실기/시뮬레이터에선 진짜 임베더를 주입.
 */

/** 텍스트 배열 → 임베딩 벡터 배열. 주입 가능한 함수 타입. */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export type FoodSplit = 'seed' | 'test';

/**
 * 배달 같이 시키기 게시글 한 건.
 * cuisine(요리 종류)과 category(음식 카테고리) 두 라벨을 동시에 갖는다.
 */
export interface LabeledPost {
  id: string;
  title: string;
  body: string;
  /** 요리 종류: 한식 | 중식 | 일식 | 양식 | 분식 | 치킨 */
  cuisine: string;
  /** 음식 카테고리: 치킨 | 피자 | 버거 | 떡볶이 | 중식면 | 초밥·회 | 라멘·돈까스 | 족발·보쌈 | 마라탕 | 카페·디저트 */
  category: string;
  /** 프로토타입 빌드용(seed) vs 평가용(test) */
  split: FoodSplit;
}

/** 클래스별 centroid 프로토타입. seed 임베딩 평균 후 L2 정규화. */
export interface LabelPrototype {
  label: string;
  centroid: number[];
}

/** 단일 게시글 분류 결과 */
export interface ClassifierResult {
  /** 최고 유사도 라벨 */
  label: string;
  /** 최고 유사도 점수 (코사인, [0,1]) */
  score: number;
  /** 전체 라벨 유사도 순위 */
  ranked: { label: string; score: number }[];
}

/** 클래스별 정밀도/재현율/F1 */
export interface ClassMetrics {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  /** 해당 클래스의 테스트 샘플 수 */
  support: number;
}

/** evaluate() 반환값 — 전체 평가 결과 */
export interface EvalReport {
  accuracy: number;
  classMetrics: ClassMetrics[];
  /** confusion[actual][predicted] = count */
  confusion: Record<string, Record<string, number>>;
  /** 오분류 게시글 목록 (진단용) */
  misclassified: {
    post: LabeledPost;
    predicted: string;
    score: number;
    actual: string;
  }[];
}
