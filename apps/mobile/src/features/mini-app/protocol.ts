/**
 * 인앱 브라우저 WebView↔RN 메시지 프로토콜 (의존성 없는 순수 모듈).
 *
 * 공유 @skkuverse/bridge whitelist를 거치지 않는 화면 로컬 프로토콜이다. injected
 * 추출 스크립트가 보내는 메시지를 sentinel로 식별 — 다른 postMessage(광고 SDK 등)와 격리.
 * (import 0개로 유지해 node --test에서 단위 검증 가능.)
 */

/** WebView→RN 메시지 식별용 sentinel. */
export const PAGE_MSG_SENTINEL = '__skku_ai_page__';

/** readability 결과가 이 미만이면 innerText 폴백 → 그래도 빈손이면 Jina 폴백 대상. */
export const MIN_EXTRACT_CHARS = 120;

/** 개발/기본 진입 URL (사용자 지정). https — iOS ATS가 cleartext http 차단(open.ts 주석 참조). */
export const DEFAULT_BROWSER_URL = 'https://student.skku.edu/student/notice2.do';

export interface PageExtractedMessage {
  sentinel: typeof PAGE_MSG_SENTINEL;
  type: 'page_extracted';
  title: string;
  text: string;
  url: string;
}

export interface PageExtractErrorMessage {
  sentinel: typeof PAGE_MSG_SENTINEL;
  type: 'page_extract_error';
  message: string;
}

export type PageMessage = PageExtractedMessage | PageExtractErrorMessage;

/**
 * 페이지 URL → 고화질 파비콘 URL (Google faviconV2, 기본 size=128).
 *
 * 사이트가 직접 주는 `<link rel="icon">`은 보통 16px 저해상도 → retina에서 흐림.
 * origin만 넘기면 faviconV2가 고해상도 아이콘을 반환한다(없으면 도메인 이니셜 폴백).
 * http/https origin이 아니면(about:blank 등 opaque origin → origin === 'null') null.
 */
export function faviconUrl(pageUrl: string, size = 128): string | null {
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const params = `client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(u.origin)}&size=${size}`;
    return `https://t1.gstatic.com/faviconV2?${params}`;
  } catch {
    return null;
  }
}

const VALID_TYPES = new Set(['page_extracted', 'page_extract_error']);

/** WebView onMessage의 raw 문자열을 우리 프로토콜로 파싱(아니면 null). */
export function parsePageMessage(raw: string): PageMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { sentinel?: unknown }).sentinel === PAGE_MSG_SENTINEL &&
      typeof (parsed as { type?: unknown }).type === 'string' &&
      VALID_TYPES.has((parsed as { type: string }).type)
    ) {
      return parsed as PageMessage;
    }
  } catch {
    /* 우리 메시지가 아님 */
  }
  return null;
}
