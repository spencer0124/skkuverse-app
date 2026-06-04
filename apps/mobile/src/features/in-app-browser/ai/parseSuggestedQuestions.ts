/**
 * 추천 질문 파서 (순수 함수, import 0개).
 *
 * 2.1B Q4 모델은 형식이 들쭉날쭉하다 — strict JSON 강제 대신 줄 구분 출력을 받아
 * 관용적으로 정리한다(기존 notices/ai도 의도적으로 JSON 미사용). 번호·불릿·따옴표·
 * 라벨 라인·중복·과다 개수를 모두 흡수하고, 혹 JSON 배열로 와도 받아준다.
 */

const LEADING_MARKER = /^(?:\d+\s*[.)]|[-*•·▪‣]|Q\d*\s*[:.]?)\s*/i;
const LEADING_QUOTE = /^["'“”‘’[(]+/;
const TRAILING_QUOTE = /["'“”‘’\])]+$/;

function clean(line: string): string {
  let s = line.trim();
  if (!s) return '';
  s = s.replace(LEADING_MARKER, '');
  s = s.replace(LEADING_QUOTE, '').replace(TRAILING_QUOTE, '');
  s = s.replace(/,\s*$/, '');
  return s.trim();
}

/**
 * @param raw  모델 원본 출력
 * @param max  최대 칩 개수 (기본 4)
 * @returns 정리된 질문 문자열 배열 (중복 제거, max 제한)
 */
export function parseSuggestedQuestions(raw: string, max = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (candidate: string): void => {
    const c = clean(candidate);
    if (!c || c.endsWith(':')) return; // 빈 줄/라벨 라인 제외
    if (seen.has(c)) return;
    seen.add(c);
    out.push(c);
  };

  if (!raw || !raw.trim()) return out;

  // JSON 배열 출력 우선 시도
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr: unknown = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'string') push(item);
          if (out.length >= max) break;
        }
        if (out.length > 0) return out.slice(0, max);
      }
    } catch {
      /* 줄 파싱으로 폴백 */
    }
  }

  for (const line of raw.split('\n')) {
    push(line);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}
