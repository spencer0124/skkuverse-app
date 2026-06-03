/**
 * 온디바이스 LLM에 줄 공지 컨텍스트 문자열 빌더 (순수 함수).
 *
 * 정책 (사용자 확정):
 *   - 제목은 항상 포함.
 *   - 제목 + 본문이 예산 안에 들어가면 그대로 사용.
 *   - 초과하면: 제목 + (서버 요약 있으면 요약) + 남는 예산만큼 본문 head + '…'.
 *
 * ⚠️ 예산은 char 휴리스틱이다 (정밀 토큰 카운트 아님).
 *    Kanana n_ctx=8192에서 답변(n_predict 512)·질문·시스템 지시문 오버헤드를 reserve하면
 *    입력 컨텍스트로 ~7500토큰 여유가 있다. 토크나이저 조밀 worst-case를 감안해
 *    8000자로 잡아 overflow(앞부분 잘림)를 차단(원본 ~1.6자/토큰 기준 ~5000토큰).
 *    n_ctx(local-llm.ts) 변경 시 이 값도 함께 맞출 것. 정밀 제어가 필요하면
 *    모델 tokenize() 기반으로 교체. (plan: delightful-greeting-adleman.md)
 */

/** 컨텍스트에 허용하는 최대 문자 수. (n_ctx=8192에 종속) */
export const CONTEXT_CHAR_BUDGET = 8000;

/**
 * markdown 잡음 제거 — 이미지 문법은 토큰만 먹고 모델에 의미 없음.
 *   - `![{WxH} alt](url)` / `![alt](url)` 이미지 → 제거
 *   - 링크 `[text](url)` → text만 남김
 *   - 3개 이상 연속 개행 → 2개로 축소
 */
function stripMarkdownNoise(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 이미지
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 링크 → 라벨
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildNoticeContext(
  title: string,
  contentMarkdown: string | null | undefined,
  summary: string | null | undefined,
  budget: number = CONTEXT_CHAR_BUDGET,
): string {
  const header = `제목: ${title}\n\n`;
  const content = stripMarkdownNoise(contentMarkdown ?? '');

  // 본문이 통째로 들어가는 경우
  if (header.length + content.length <= budget) {
    return (header + content).trim();
  }

  // 초과 — 요약(있으면) 먼저 넣고 남는 자리에 본문 head
  let out = header;
  const summaryText = summary?.trim();
  if (summaryText) {
    out += `요약: ${summaryText}\n\n본문(일부):\n`;
  } else {
    out += `본문(일부):\n`;
  }

  const remaining = budget - out.length;
  if (remaining > 0 && content.length > 0) {
    out += content.slice(0, remaining).trimEnd() + '…';
  }
  return out.trim();
}
