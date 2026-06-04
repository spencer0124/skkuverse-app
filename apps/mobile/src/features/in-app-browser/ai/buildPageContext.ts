/**
 * 온디바이스 LLM에 줄 "페이지" 컨텍스트 문자열 빌더 (순수 함수, import 0개).
 *
 * notices/ai/buildNoticeContext의 truncation 정책을 페이지용으로 복제한다. 차이:
 *   - 입력은 markdown이 아니라 readability/Jina 평문 → stripMarkdownNoise 대신
 *     공백/개행 정규화만.
 *   - 제목이 비면(웹 페이지가 title 못 줄 때) 제목 라인을 생략.
 *
 * ⚠️ 예산은 char 휴리스틱(정밀 토큰 카운트 아님). Kanana n_ctx=8192에서 답변/질문/
 *    시스템 지시문 오버헤드를 reserve하면 입력 ~7500토큰 여유 → 토크나이저 worst-case
 *    감안 8000자로 차단. local-llm.ts의 n_ctx, buildNoticeContext의 CONTEXT_CHAR_BUDGET와
 *    함께 맞출 것(현재 동일 8000).
 */

/** 컨텍스트 최대 문자 수. (n_ctx=8192 종속, buildNoticeContext와 동일 값) */
export const PAGE_CONTEXT_CHAR_BUDGET = 8000;

/** 공백 런 축소 + 줄 끝 공백 제거 + 3개 이상 연속 개행 → 2개. */
function normalize(text: string): string {
  return text
    .replace(/[\t  ]+/g, ' ')
    .replace(/ *\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildPageContext(
  title: string,
  text: string,
  budget: number = PAGE_CONTEXT_CHAR_BUDGET,
): string {
  const cleanTitle = title.trim();
  const header = cleanTitle ? `제목: ${cleanTitle}\n\n` : '';
  const body = normalize(text);

  if (header.length + body.length <= budget) {
    return (header + body).trim();
  }

  const remaining = budget - header.length - 1; // '…' 자리 확보
  const head = remaining > 0 ? body.slice(0, remaining).trimEnd() : '';
  return (header + head + '…').trim();
}
