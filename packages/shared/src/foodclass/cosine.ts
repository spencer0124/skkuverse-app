/**
 * 벡터 유사도 유틸 — 순수 함수, 의존성 없음.
 *
 * Apple NLContextualEmbedding은 정규화된 벡터를 반환하지 않으므로
 * l2normalize를 직접 적용해야 코사인 유사도가 올바르게 계산된다.
 */

/**
 * L2 정규화. 벡터를 제자리에서 단위 벡터로 변환한 후 반환.
 * 영벡터(norm=0)는 그대로 둔다 — NaN 방지.
 */
export function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (norm === 0) return v;
  for (let i = 0; i < v.length; i++) {
    v[i] = v[i]! / norm;
  }
  return v;
}

/**
 * 두 단위 벡터 간 코사인 유사도 (내적).
 * 호출 전 두 벡터 모두 l2normalize가 적용된 상태여야 한다.
 * 반환값 범위: [-1, 1]. 임베딩에선 사실상 [0, 1].
 */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}
