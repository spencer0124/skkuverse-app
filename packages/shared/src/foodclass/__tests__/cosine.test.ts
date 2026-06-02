import { describe, it, expect } from 'vitest';
import { l2normalize, cosineSim } from '../cosine';

describe('l2normalize', () => {
  it('3-4-5 직각삼각형: [3,4] → [0.6, 0.8]', () => {
    const v = [3, 4];
    const result = l2normalize(v);
    expect(result[0]).toBeCloseTo(0.6, 10);
    expect(result[1]).toBeCloseTo(0.8, 10);
  });

  it('제자리 수정: 반환 참조가 입력 배열과 동일', () => {
    const v = [1, 2, 3];
    const result = l2normalize(v);
    expect(result).toBe(v);
  });

  it('단위 벡터는 그대로 유지', () => {
    const v = [1, 0, 0];
    l2normalize(v);
    expect(v[0]).toBeCloseTo(1, 10);
    expect(v[1]).toBeCloseTo(0, 10);
    expect(v[2]).toBeCloseTo(0, 10);
  });

  it('영벡터는 그대로 유지 (NaN 방지)', () => {
    const v = [0, 0, 0];
    l2normalize(v);
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
    expect(v[2]).toBe(0);
  });

  it('정규화 후 norm이 1', () => {
    const v = [1, 2, 3, 4, 5];
    l2normalize(v);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 10);
  });
});

describe('cosineSim', () => {
  it('같은 단위 벡터: 1.0', () => {
    const a = l2normalize([1, 0]);
    const b = [1, 0];
    expect(cosineSim(a, b)).toBeCloseTo(1, 10);
  });

  it('반대 방향 벡터: -1.0', () => {
    const a = l2normalize([1, 0]);
    const b = l2normalize([-1, 0]);
    expect(cosineSim(a, b)).toBeCloseTo(-1, 10);
  });

  it('수직(orthogonal) 벡터: 0.0', () => {
    const a = l2normalize([1, 0]);
    const b = l2normalize([0, 1]);
    expect(cosineSim(a, b)).toBeCloseTo(0, 10);
  });

  it('45도 회전: ~0.707', () => {
    const a = l2normalize([1, 0]);
    const b = l2normalize([1, 1]);
    expect(cosineSim(a, b)).toBeCloseTo(Math.SQRT2 / 2, 10);
  });

  it('고차원 벡터 — 정규화된 동일 벡터는 1.0', () => {
    const raw = Array.from({ length: 512 }, (_, i) => Math.sin(i));
    const a = l2normalize([...raw]);
    const b = l2normalize([...raw]);
    expect(cosineSim(a, b)).toBeCloseTo(1, 8);
  });
});
