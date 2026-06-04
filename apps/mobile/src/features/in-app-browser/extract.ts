/**
 * 인앱 브라우저 본문 추출 — 2단 전략.
 *
 *   1) 온디바이스: 벤더링한 @mozilla/readability를 페이지에 주입해 본문 추출
 *      (injectJavaScript → postMessage 왕복). 프라이버시·오프라인 기본 경로.
 *   2) 폴백: 1)이 빈손이면 RN 쪽에서 r.jina.ai로 마크다운을 받아온다.
 *      ⚠️ 이 경로는 현재 페이지 URL을 외부 서버(Jina)로 보낸다 — 온디바이스 원칙의
 *         의도적 예외(추출 실패 구제용). readability가 뽑으면 절대 타지 않는다.
 *
 * 메시지 타입/파서/상수는 의존성 없는 ./protocol에 분리(node --test 단위검증용).
 * 이 파일은 readability 원본 문자열을 import하므로 RN 번들 전용.
 *
 * Phase 0 실측(2026-06-04): http://student.skku.edu/student/notice2.do 게시판 목록에서
 *   readability 1,895자(메뉴 제거된 공지 리스트), Jina 5.9KB 모두 양호 — 게이트 통과.
 */

import { READABILITY_SOURCE } from './readability.injected';
import { PAGE_MSG_SENTINEL, MIN_EXTRACT_CHARS } from './protocol';

/**
 * 페이지에 주입할 추출 스크립트. AI 시트 open 시 1회 injectJavaScript.
 *
 * READABILITY_SOURCE(벤더 원본 텍스트)를 IIFE 안에 인라인 → `function Readability`가
 * IIFE 스코프에 선언된다(페이지엔 module 없어 export 라인 no-op). cloneNode로 라이브
 * DOM 보호 후 parse, 빈손이면 innerText 폴백. react-native-webview 규약상 `true;`로 종료.
 */
export function buildExtractScript(): string {
  return `(function(){
  try {
    ${READABILITY_SOURCE}
    var article = null;
    try { article = new Readability(document.cloneNode(true)).parse(); } catch (e) { article = null; }
    var text = (article && article.textContent ? String(article.textContent) : '')
      .replace(/[\\t\\u00a0 ]+/g, ' ')
      .replace(/ *\\n/g, '\\n')
      .replace(/\\n{3,}/g, '\\n\\n')
      .trim();
    var title = (article && article.title) ? String(article.title) : (document.title || '');
    if (text.length < ${MIN_EXTRACT_CHARS}) {
      var body = (document.body && document.body.innerText) ? String(document.body.innerText) : '';
      var bt = body.replace(/[\\t\\u00a0 ]+/g, ' ').replace(/ *\\n/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
      if (bt.length > text.length) { text = bt; }
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({
      sentinel: '${PAGE_MSG_SENTINEL}', type: 'page_extracted',
      title: title, text: text, url: location.href
    }));
  } catch (err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      sentinel: '${PAGE_MSG_SENTINEL}', type: 'page_extract_error',
      message: String(err && err.message ? err.message : err)
    }));
  }
})();
true;`;
}

/**
 * Jina Reader 폴백 — 페이지 URL을 마크다운으로 변환해 받아온다.
 * ⚠️ URL이 외부 서버로 전송된다(위 파일 주석 참조). readability 실패 시에만 호출.
 * 응답 앞부분의 `Title:/URL Source:/Markdown Content:` preamble은 잘라 본문만 반환.
 */
export async function fetchJinaMarkdown(
  url: string,
  timeoutMs = 20_000,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) return null;
    const md = (await res.text()).trim();
    if (!md) return null;
    // preamble 제거: "Markdown Content:" 이후만, 없으면 통째.
    const marker = md.indexOf('Markdown Content:');
    const body = marker >= 0 ? md.slice(marker + 'Markdown Content:'.length).trim() : md;
    return body.length > 0 ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
