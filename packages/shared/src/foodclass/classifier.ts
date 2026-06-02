/**
 * Few-shot 프로토타입 분류기.
 *
 * 파이프라인:
 * 1. buildPrototypes — seed 게시글 임베딩 평균 → L2 정규화 centroid
 * 2. classify       — 쿼리 임베딩 vs centroid 코사인 argmax
 * 3. evaluate       — test 셋 accuracy + class별 precision/recall/F1 + confusion matrix
 *
 * EmbedFn을 주입받아 네이티브 의존성이 없으므로 vitest로 결정적 검증 가능.
 * labelOf: (p) => p.cuisine 또는 (p) => p.category 로 두 축에 동일 파이프라인 재사용.
 */

import { cosineSim, l2normalize } from './cosine';
import type {
  ClassMetrics,
  EmbedFn,
  EvalReport,
  LabeledPost,
  LabelPrototype,
} from './types';

/**
 * 클래스별 centroid 프로토타입 빌드.
 *
 * 각 seed 게시글을 `${title} ${body}` 형식으로 인코딩.
 * 같은 라벨의 임베딩 벡터를 평균낸 후 L2 정규화.
 */
export async function buildPrototypes(
  seedPosts: LabeledPost[],
  labelOf: (p: LabeledPost) => string,
  embed: EmbedFn,
): Promise<LabelPrototype[]> {
  // 라벨별로 그룹핑
  const groups = new Map<string, LabeledPost[]>();
  for (const post of seedPosts) {
    const label = labelOf(post);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(post);
  }

  const prototypes: LabelPrototype[] = [];

  for (const [label, posts] of groups) {
    const texts = posts.map(p => `${p.title} ${p.body}`);
    const embeddings = await embed(texts);

    if (embeddings.length === 0 || !embeddings[0]) continue;

    const dim = embeddings[0].length;
    const centroid = new Array<number>(dim).fill(0);

    for (const vec of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i]! += (vec[i] ?? 0) / embeddings.length;
      }
    }

    l2normalize(centroid);
    prototypes.push({ label, centroid });
  }

  return prototypes;
}

/**
 * 단일 텍스트를 프로토타입과 비교해 분류.
 * 쿼리 임베딩을 정규화 후 각 centroid와 코사인 유사도 계산, argmax 반환.
 */
export async function classify(
  text: string,
  prototypes: LabelPrototype[],
  embed: EmbedFn,
): Promise<{ label: string; score: number; ranked: { label: string; score: number }[] }> {
  const rawEmbeddings = await embed([text]);
  const queryVec = l2normalize([...(rawEmbeddings[0] ?? [])]);

  const ranked = prototypes
    .map(proto => ({
      label: proto.label,
      score: cosineSim(queryVec, proto.centroid),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    label: ranked[0]?.label ?? '',
    score: ranked[0]?.score ?? 0,
    ranked,
  };
}

/**
 * test 셋 전체를 평가해 accuracy / class별 지표 / confusion matrix / 오분류 목록 반환.
 *
 * confusion[actual][predicted] = count.
 * 모든 라벨은 prototypes에서 추출하므로 데이터셋에 없는 라벨도 행/열이 생긴다.
 */
export async function evaluate(
  testPosts: LabeledPost[],
  prototypes: LabelPrototype[],
  labelOf: (p: LabeledPost) => string,
  embed: EmbedFn,
): Promise<EvalReport> {
  const allLabels = prototypes.map(p => p.label);

  // confusion matrix 초기화
  const confusion: Record<string, Record<string, number>> = {};
  for (const actual of allLabels) {
    confusion[actual] = {};
    for (const predicted of allLabels) {
      confusion[actual]![predicted] = 0;
    }
  }

  let correct = 0;
  const misclassified: EvalReport['misclassified'] = [];

  for (const post of testPosts) {
    const actual = labelOf(post);
    const result = await classify(`${post.title} ${post.body}`, prototypes, embed);
    const predicted = result.label;

    // confusion matrix에 실제/예측 라벨이 없을 수 있는 edge case 방어
    if (!confusion[actual]) confusion[actual] = {};
    if (confusion[actual]![predicted] === undefined) {
      confusion[actual]![predicted] = 0;
    }
    confusion[actual]![predicted]! += 1;

    if (predicted === actual) {
      correct++;
    } else {
      misclassified.push({ post, predicted, score: result.score, actual });
    }
  }

  const accuracy = testPosts.length === 0 ? 0 : correct / testPosts.length;

  // 클래스별 precision / recall / F1
  const classMetrics: ClassMetrics[] = allLabels.map(label => {
    const tp = confusion[label]?.[label] ?? 0;

    // 다른 클래스가 label로 잘못 분류된 수 (false positive)
    const fp = allLabels.reduce((sum, actual) => {
      if (actual === label) return sum;
      return sum + (confusion[actual]?.[label] ?? 0);
    }, 0);

    // label이 다른 클래스로 잘못 분류된 수 (false negative)
    const fn = allLabels.reduce((sum, predicted) => {
      if (predicted === label) return sum;
      return sum + (confusion[label]?.[predicted] ?? 0);
    }, 0);

    const support = tp + fn;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    return { label, precision, recall, f1, support };
  });

  return { accuracy, classMetrics, confusion, misclassified };
}
