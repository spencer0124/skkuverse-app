import { useQueries } from '@tanstack/react-query';

/**
 * 본문에서 뽑은 링크의 Open Graph 미리보기.
 *
 * **왜 클라이언트에서 직접 가져오는가.** skkuverse-server에는 unfurl/OG
 * 엔드포인트가 없다(`notices.controller.ts`의 라우트는 tabs / source /
 * proxy·attachment / 상세 4개뿐). 서버가 대신 긁어 캐시해 주는 쪽이 데이터
 * 사용량·안정성 모두 낫지만, 그건 다른 레포의 작업이라 우선 단말에서 직접
 * 가져온다. 나중에 서버 엔드포인트가 생기면 이 훅의 `queryFn`만 갈아끼우면
 * 되고 호출부는 그대로다.
 *
 * **실패를 정상으로 취급한다.** 대상이 임의의 외부 사이트라 실패 경로가 많다
 * — 봇 차단, JS 렌더링 전용 페이지(구글 폼이 대표적), OG 태그 없음, 타임아웃.
 * 실패하면 `null`을 돌려주고 호출부는 도메인만 있는 기본 행으로 그린다.
 * 그래서 `retry: false`다 — 어차피 폴백이 멀쩡한데 재시도로 지연만 늘릴
 * 이유가 없다.
 */

export interface LinkPreview {
  title: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

/** HTML 앞부분만 본다 — `<head>`를 지나면 OG 태그는 더 안 나온다. */
const SCAN_LIMIT = 120_000;
const FETCH_TIMEOUT_MS = 6_000;

function pickMeta(html: string, property: string): string | null {
  // property / name 양쪽을 받고, 속성 순서도 뒤집힐 수 있어(content가 먼저)
  // 두 방향 모두 시도한다. 정규식 파싱이지만 `<head>` 안의 meta 태그는
  // 중첩이 없어 안전한 편 — 전체 DOM 파서를 들일 만한 대상이 아니다.
  const attr = `(?:property|name)=["']${property}["']`;
  const forward = html.match(new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']*)["']`, 'i'));
  if (forward?.[1]) return decodeEntities(forward[1]);
  const backward = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}`, 'i'));
  return backward?.[1] ? decodeEntities(backward[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * 깨진 인코딩으로 읽힌 문자열인지.
 *
 * 한국 구형 사이트 중에는 **헤더로는 `charset=utf-8`이라 하고 실제로는
 * EUC-KR 바이트를 내려주는** 곳이 있다(실측: `www.aik.or.kr`). 그러면
 * `res.text()`가 UTF-8로 디코드하다 실패해 U+FFFD(`�`)를 흩뿌린다.
 *
 * 헤더가 거짓말을 하니 charset 협상으로는 못 고치고, Hermes에는
 * `TextDecoder('euc-kr')`가 없어 재디코딩도 불가능하다. 그래서 감지해서
 * **버린다** — 도메인 폴백이 깨진 글자보다 낫다. 이미지 URL은 ASCII라
 * 살아남으므로 그건 그대로 쓴다.
 */
function isMojibake(s: string): boolean {
  return s.includes('�');
}

function absolutize(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

async function fetchPreview(url: string): Promise<LinkPreview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 기본 RN User-Agent로는 봇으로 보고 막는 사이트가 있다.
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return null;

    const html = (await res.text()).slice(0, SCAN_LIMIT);
    const rawTitle =
      pickMeta(html, 'og:title') ??
      pickMeta(html, 'twitter:title') ??
      decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const title = rawTitle && !isMojibake(rawTitle) ? rawTitle : null;

    const imageUrl = absolutize(
      pickMeta(html, 'og:image') ?? pickMeta(html, 'twitter:image'),
      // 리디렉트를 따라갔을 수 있으므로 최종 URL 기준으로 상대경로를 푼다.
      res.url || url,
    );

    if (!title && !imageUrl) return null;

    const rawSite = pickMeta(html, 'og:site_name');
    return {
      title,
      imageUrl,
      siteName: rawSite && !isMojibake(rawSite) ? rawSite : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function useLinkPreviews(urls: readonly string[]) {
  return useQueries({
    queries: urls.map((url) => ({
      queryKey: ['link-preview', url] as const,
      queryFn: () => fetchPreview(url),
      // 공지 링크가 가리키는 페이지는 자주 안 바뀐다. 하루 동안은 재요청하지
      // 않는다 — 목록↔상세를 오갈 때마다 외부 사이트를 긁으면 민폐다.
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
      // 포그라운드 복귀·재마운트마다 외부 사이트를 다시 치지 않게.
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    })),
  });
}
