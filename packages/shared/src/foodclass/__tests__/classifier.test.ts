/**
 * 분류기 파이프라인 테스트.
 *
 * 네이티브 임베더 없이 vitest에서 결정적 검증이 가능하도록
 * 가짜 EmbedFn을 주입:
 *   - perfectEmbed: 라벨별 one-hot 벡터 → buildPrototypes/classify/evaluate 배선 검증
 *   - noisyEmbed:   일부 오분류를 고의로 주입 → confusion matrix·F1 산식 검증
 */

import { describe, it, expect } from 'vitest';
import type { EmbedFn, LabeledPost } from '../types';
import { buildPrototypes, classify, evaluate } from '../classifier';

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────

/** 라벨 목록의 인덱스를 차원으로 쓰는 one-hot 임베더 */
function makePerfectEmbed(labels: string[]): EmbedFn {
  return async (texts: string[]) => {
    return texts.map(text => {
      const matchedLabel = labels.find(l => text.includes(l));
      const dim = labels.indexOf(matchedLabel ?? labels[0]!);
      const vec = new Array<number>(labels.length).fill(0);
      vec[dim] = 1.0;
      return vec;
    });
  };
}

/** seed posts 헬퍼 */
function makePosts(
  items: { id: string; label: string; split: 'seed' | 'test' }[],
  axis: 'cuisine' | 'category',
): LabeledPost[] {
  return items.map(({ id, label, split }) => ({
    id,
    title: `${label} 배달 테스트`,
    body: `${label} 같이 시킬 분 구해요`,
    cuisine: axis === 'cuisine' ? label : '한식',
    category: axis === 'category' ? label : '치킨',
    split,
  }));
}

// ──────────────────────────────────────────────────────────────
// buildPrototypes
// ──────────────────────────────────────────────────────────────

describe('buildPrototypes', () => {
  it('2개 클래스 seed → 2개 프로토타입 반환', async () => {
    const labels = ['A', 'B'];
    const embed = makePerfectEmbed(labels);
    const seeds = makePosts(
      [
        { id: 's1', label: 'A', split: 'seed' },
        { id: 's2', label: 'A', split: 'seed' },
        { id: 's3', label: 'B', split: 'seed' },
      ],
      'cuisine',
    );
    const protos = await buildPrototypes(seeds, p => p.cuisine, embed);
    expect(protos).toHaveLength(2);
    expect(protos.map(p => p.label).sort()).toEqual(['A', 'B']);
  });

  it('동일 라벨 seed 2개 → centroid가 L2 정규화된 단위 벡터', async () => {
    const labels = ['X'];
    const embed = makePerfectEmbed(labels);
    const seeds = makePosts(
      [
        { id: 's1', label: 'X', split: 'seed' },
        { id: 's2', label: 'X', split: 'seed' },
      ],
      'cuisine',
    );
    const protos = await buildPrototypes(seeds, p => p.cuisine, embed);
    const centroid = protos[0]!.centroid;
    const norm = Math.sqrt(centroid.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 8);
  });
});

// ──────────────────────────────────────────────────────────────
// classify
// ──────────────────────────────────────────────────────────────

describe('classify', () => {
  it('perfect embed → 정확한 라벨 반환', async () => {
    const labels = ['치킨', '피자', '버거'];
    const embed = makePerfectEmbed(labels);
    const seeds = makePosts(
      labels.map((l, i) => ({ id: `s${i}`, label: l, split: 'seed' as const })),
      'category',
    );
    const protos = await buildPrototypes(seeds, p => p.category, embed);

    const result = await classify('피자 같이 시킬 분', protos, embed);
    expect(result.label).toBe('피자');
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.ranked[0]?.label).toBe('피자');
  });

  it('ranked 배열의 길이가 prototype 수와 같음', async () => {
    const labels = ['A', 'B', 'C', 'D'];
    const embed = makePerfectEmbed(labels);
    const seeds = makePosts(
      labels.map((l, i) => ({ id: `s${i}`, label: l, split: 'seed' as const })),
      'cuisine',
    );
    const protos = await buildPrototypes(seeds, p => p.cuisine, embed);
    const result = await classify('A 배달', protos, embed);
    expect(result.ranked).toHaveLength(labels.length);
  });

  it('ranked는 score 내림차순 정렬', async () => {
    const labels = ['A', 'B', 'C'];
    const embed = makePerfectEmbed(labels);
    const seeds = makePosts(
      labels.map((l, i) => ({ id: `s${i}`, label: l, split: 'seed' as const })),
      'cuisine',
    );
    const protos = await buildPrototypes(seeds, p => p.cuisine, embed);
    const result = await classify('A 배달', protos, embed);
    for (let i = 0; i < result.ranked.length - 1; i++) {
      expect(result.ranked[i]!.score).toBeGreaterThanOrEqual(result.ranked[i + 1]!.score);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// evaluate — perfect embed (accuracy=1.0)
// ──────────────────────────────────────────────────────────────

describe('evaluate — perfect embed', () => {
  const labels = ['치킨', '피자', '버거'];

  async function buildPerfectFixture() {
    const embed = makePerfectEmbed(labels);
    const allPosts = makePosts(
      [
        { id: 's1', label: '치킨', split: 'seed' },
        { id: 's2', label: '피자', split: 'seed' },
        { id: 's3', label: '버거', split: 'seed' },
        { id: 't1', label: '치킨', split: 'test' },
        { id: 't2', label: '피자', split: 'test' },
        { id: 't3', label: '버거', split: 'test' },
      ],
      'category',
    );
    const seeds = allPosts.filter(p => p.split === 'seed');
    const tests = allPosts.filter(p => p.split === 'test');
    const protos = await buildPrototypes(seeds, p => p.category, embed);
    return { embed, protos, tests };
  }

  it('accuracy = 1.0', async () => {
    const { embed, protos, tests } = await buildPerfectFixture();
    const report = await evaluate(tests, protos, p => p.category, embed);
    expect(report.accuracy).toBeCloseTo(1.0, 10);
  });

  it('오분류 목록이 비어 있음', async () => {
    const { embed, protos, tests } = await buildPerfectFixture();
    const report = await evaluate(tests, protos, p => p.category, embed);
    expect(report.misclassified).toHaveLength(0);
  });

  it('모든 클래스의 F1 = 1.0', async () => {
    const { embed, protos, tests } = await buildPerfectFixture();
    const report = await evaluate(tests, protos, p => p.category, embed);
    for (const m of report.classMetrics) {
      expect(m.f1).toBeCloseTo(1.0, 10);
    }
  });

  it('confusion matrix 대각선만 채워짐', async () => {
    const { embed, protos, tests } = await buildPerfectFixture();
    const report = await evaluate(tests, protos, p => p.category, embed);
    for (const actual of labels) {
      for (const predicted of labels) {
        const expected = actual === predicted ? 1 : 0;
        expect(report.confusion[actual]?.[predicted] ?? 0).toBe(expected);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────
// evaluate — noisy embed (알려진 오분류 주입)
// ──────────────────────────────────────────────────────────────

describe('evaluate — noisy embed (오분류 1건)', () => {
  /**
   * 설계:
   *   클래스: A, B
   *   seed: A×1, B×1
   *   test: A×2 (하나는 B로 오분류), B×2 (모두 정확)
   *
   *   → confusion: A[A]=1, A[B]=1, B[A]=0, B[B]=2
   *   → accuracy = 3/4 = 0.75
   *   → A: precision=1.0, recall=0.5, f1=0.667
   *   → B: precision=2/3, recall=1.0, f1=0.8
   */
  const LABELS = ['A', 'B'];

  /** 텍스트에 "B" 포함 + id="mistake" → B로 반환, 나머지는 정상 */
  const noisyEmbed: EmbedFn = async (texts: string[]) => {
    return texts.map(text => {
      // "mistake" 키워드가 있으면 A 텍스트도 B 벡터 반환
      const forceB = text.includes('mistake');
      const vec = new Array<number>(LABELS.length).fill(0);
      if (forceB || text.includes('B')) {
        vec[1] = 1.0; // B 차원
      } else {
        vec[0] = 1.0; // A 차원
      }
      return vec;
    });
  };

  const seedPosts: LabeledPost[] = [
    { id: 'sA', title: 'A 배달', body: 'A 같이 시킬 분', cuisine: 'A', category: 'A', split: 'seed' },
    { id: 'sB', title: 'B 배달', body: 'B 같이 시킬 분', cuisine: 'B', category: 'B', split: 'seed' },
  ];

  const testPosts: LabeledPost[] = [
    // A 정확 분류
    { id: 'tA1', title: 'A 배달', body: 'A 같이 시킬 분', cuisine: 'A', category: 'A', split: 'test' },
    // A → B 오분류 (title에 "mistake" 삽입)
    {
      id: 'tA2-mistake',
      title: 'mistake 배달',
      body: 'A 같이 시킬 분',
      cuisine: 'A',
      category: 'A',
      split: 'test',
    },
    // B 정확 분류 ×2
    { id: 'tB1', title: 'B 배달', body: 'B 같이 시킬 분', cuisine: 'B', category: 'B', split: 'test' },
    { id: 'tB2', title: 'B 배달 추가', body: 'B 주문', cuisine: 'B', category: 'B', split: 'test' },
  ];

  it('accuracy = 0.75', async () => {
    const protos = await buildPrototypes(seedPosts, p => p.cuisine, noisyEmbed);
    const report = await evaluate(testPosts, protos, p => p.cuisine, noisyEmbed);
    expect(report.accuracy).toBeCloseTo(0.75, 8);
  });

  it('오분류 목록에 tA2-mistake 포함', async () => {
    const protos = await buildPrototypes(seedPosts, p => p.cuisine, noisyEmbed);
    const report = await evaluate(testPosts, protos, p => p.cuisine, noisyEmbed);
    expect(report.misclassified).toHaveLength(1);
    expect(report.misclassified[0]?.post.id).toBe('tA2-mistake');
    expect(report.misclassified[0]?.predicted).toBe('B');
    expect(report.misclassified[0]?.actual).toBe('A');
  });

  it('confusion matrix 카운트 정확', async () => {
    const protos = await buildPrototypes(seedPosts, p => p.cuisine, noisyEmbed);
    const report = await evaluate(testPosts, protos, p => p.cuisine, noisyEmbed);
    expect(report.confusion['A']?.['A']).toBe(1);
    expect(report.confusion['A']?.['B']).toBe(1);
    expect(report.confusion['B']?.['A']).toBe(0);
    expect(report.confusion['B']?.['B']).toBe(2);
  });

  it('클래스 A: precision=1.0, recall=0.5, f1≈0.667', async () => {
    const protos = await buildPrototypes(seedPosts, p => p.cuisine, noisyEmbed);
    const report = await evaluate(testPosts, protos, p => p.cuisine, noisyEmbed);
    const metricA = report.classMetrics.find(m => m.label === 'A')!;
    expect(metricA.precision).toBeCloseTo(1.0, 8);
    expect(metricA.recall).toBeCloseTo(0.5, 8);
    expect(metricA.f1).toBeCloseTo(2 / 3, 8);
  });

  it('클래스 B: precision≈0.667, recall=1.0, f1=0.8', async () => {
    const protos = await buildPrototypes(seedPosts, p => p.cuisine, noisyEmbed);
    const report = await evaluate(testPosts, protos, p => p.cuisine, noisyEmbed);
    const metricB = report.classMetrics.find(m => m.label === 'B')!;
    expect(metricB.precision).toBeCloseTo(2 / 3, 8);
    expect(metricB.recall).toBeCloseTo(1.0, 8);
    expect(metricB.f1).toBeCloseTo(0.8, 8);
  });
});

// ──────────────────────────────────────────────────────────────
// evaluate — support 필드 검증
// ──────────────────────────────────────────────────────────────

describe('evaluate — support 필드', () => {
  it('support = 해당 클래스의 test 샘플 수', async () => {
    const labels = ['A', 'B', 'C'];
    const embed = makePerfectEmbed(labels);
    const seeds = makePosts(
      labels.map((l, i) => ({ id: `s${i}`, label: l, split: 'seed' as const })),
      'cuisine',
    );
    const tests = makePosts(
      [
        { id: 't1', label: 'A', split: 'test' },
        { id: 't2', label: 'A', split: 'test' },
        { id: 't3', label: 'B', split: 'test' },
        // C는 test 없음
      ],
      'cuisine',
    );
    const protos = await buildPrototypes(seeds, p => p.cuisine, embed);
    const report = await evaluate(tests, protos, p => p.cuisine, embed);

    const mA = report.classMetrics.find(m => m.label === 'A')!;
    const mB = report.classMetrics.find(m => m.label === 'B')!;
    const mC = report.classMetrics.find(m => m.label === 'C')!;

    expect(mA.support).toBe(2);
    expect(mB.support).toBe(1);
    expect(mC.support).toBe(0);
  });
});
