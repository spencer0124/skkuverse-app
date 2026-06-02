export type {
  EmbedFn,
  FoodSplit,
  LabeledPost,
  LabelPrototype,
  ClassifierResult,
  ClassMetrics,
  EvalReport,
} from './types';

export { l2normalize, cosineSim } from './cosine';
export { buildPrototypes, classify, evaluate } from './classifier';
export { CUISINE_LABELS, CATEGORY_LABELS } from './taxonomy';
export type { CuisineLabel, CategoryLabel } from './taxonomy';
export { FOOD_POSTS } from './dataset';
