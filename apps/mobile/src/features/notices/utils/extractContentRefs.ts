/**
 * 공지 본문(GFM)에서 행동 가능한 정보를 뽑아낸다.
 *
 * 크롤러가 만든 마크다운은 본문 전체를 담고 있지만, 사용자가 실제로 "쓰는"
 * 것은 그 안의 몇 조각뿐이다 — 포스터 이미지, 신청 링크, 문의처. 그걸 요약
 * 영역으로 끌어올려 본문을 열지 않고도 행동할 수 있게 한다.
 *
 * ── 실측 근거 (2026-08-01, 3개 학과 공지 23건) ──
 *   이미지    17건 (74%)  총 20개
 *   bare URL 13건 (57%)  총 15개
 *   md 링크    3건 (13%)  총  4개   ← 링크 텍스트가 있는 경우는 드물다
 *   이메일     9건 (39%)  총 10개
 *   전화       7건 (30%)  총  7개
 *
 * 이 분포가 설계를 결정했다. `[텍스트](url)` 형태를 전제하면 대부분의 링크를
 * 놓치므로 bare URL을 1급 시민으로 다루고, 제목이 없을 땐 **도메인**을 제목
 * 자리에 쓴다.
 */

export interface ExtractedImage {
  url: string;
  /** 크롤러가 alt에 심은 `{WxH}` 힌트. 비율 예약에 쓴다. */
  width?: number;
  height?: number;
  alt: string;
}

export interface ExtractedLink {
  url: string;
  /** 마크다운 링크의 표시 텍스트. bare URL이면 null. */
  text: string | null;
  /** `www.` 를 뗀 호스트. 제목이 없을 때 제목 자리에 쓴다. */
  domain: string;
}

export interface ContentRefs {
  images: ExtractedImage[];
  links: ExtractedLink[];
  emails: string[];
  phones: string[];
}

const EMPTY: ContentRefs = { images: [], links: [], emails: [], phones: [] };

// ── 정규식 ──

/** `![alt](url)` — 반드시 링크보다 **먼저** 처리하고 마스킹해야 한다. */
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
/** `[text](url)` — 앞의 `!`를 배제해 이미지와 구분. */
const MD_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g;
/** 괄호·공백으로 끝나는 맨몸 URL. 마크다운 링크를 마스킹한 뒤에만 돌린다. */
const BARE_URL_RE = /(?<![(\w])(https?:\/\/[^\s<>()[\]"']+)/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]*[\w]/g;

/**
 * 한국 전화번호 — **반드시 `0`으로 시작**해야 한다.
 *
 * 내선까지 잡으려고 `\d{3,4}-\d{4}`를 함께 쓰면 오탐이 늘어나는 게 아니라
 * **정답이 망가진다.** 실측 23건에서 이 브랜치는 7건 전부 온전한 번호의
 * 꼬리만 잘라냈다 — `031-299-4775` → `299-4775`, `070-5153-3113` → `070-5153`.
 * 실제 샘플은 100% 지역번호(0X)로 시작했으므로 그것만 잡는다.
 */
const PHONE_RE = /(?<![\d-])(0\d{1,2})[-.]\s?(\d{3,4})[-.]\s?(\d{4})(?![\d-])/g;

/** 확장자만 보고 이미지로 판단 — bare URL이 사실 이미지인 경우를 거른다. */
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i;

// ── 헬퍼 ──

/**
 * 크롤러가 alt에 심은 치수 힌트 파싱.
 *
 * `NoticeMarkdownView`의 동명 함수와 같은 규칙이다. 그쪽은 렌더 시점에,
 * 여기는 추출 시점에 필요해서 각자 갖고 있다 — 규칙이 바뀌면 양쪽을 함께
 * 고쳐야 한다.
 */
function parseDimHint(alt: string): { width?: number; height?: number; cleanAlt: string } {
  const full = alt.match(/^\{(\d+)x(\d+)\}\s?(.*)/s);
  if (full) return { width: +full[1], height: +full[2], cleanAlt: full[3] };
  const wOnly = alt.match(/^\{w(\d+)\}\s?(.*)/s);
  if (wOnly) return { width: +wOnly[1], cleanAlt: wOnly[2] };
  const hOnly = alt.match(/^\{h(\d+)\}\s?(.*)/s);
  if (hOnly) return { height: +hOnly[1], cleanAlt: hOnly[2] };
  return { cleanAlt: alt };
}

/** 뒤에 따라붙은 문장부호 제거 — "...확인하세요: https://a.com." 같은 경우. */
function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]}>'"]+$/, '');
}

function toDomain(url: string): string {
  // `new URL()`은 Hermes에도 있지만 잘못된 URL에 throw한다. 추출된 문자열은
  // 신뢰할 수 없으므로 감싼다.
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizePhone(area: string, mid: string, last: string): string {
  return `${area}-${mid}-${last}`;
}

// ── public ──

/**
 * @param markdown 공지 본문 GFM
 * @param excludeUrls 첨부파일 URL 등 이미 화면에 있는 것 — 중복 노출 방지
 */
export function extractContentRefs(
  markdown: string | null | undefined,
  excludeUrls: readonly string[] = [],
): ContentRefs {
  if (!markdown) return EMPTY;

  const excluded = new Set(excludeUrls);

  // 1) 이미지 먼저. 뽑고 나서 본문에서 **지워야** 그 URL이 아래 링크 추출에
  //    다시 걸리지 않는다.
  const images: ExtractedImage[] = [];
  const seenImages = new Set<string>();
  let masked = markdown.replace(IMAGE_RE, (_m, alt: string, url: string) => {
    if (!seenImages.has(url) && !excluded.has(url)) {
      seenImages.add(url);
      const { width, height, cleanAlt } = parseDimHint(alt ?? '');
      images.push({ url, width, height, alt: cleanAlt });
    }
    return ' ';
  });

  // 2) 마크다운 링크. `mailto:`는 링크가 아니라 이메일로 흘려보낸다.
  const links: ExtractedLink[] = [];
  const emails: string[] = [];
  const seenLinks = new Set<string>();
  const seenEmails = new Set<string>();

  const pushLink = (rawUrl: string, text: string | null) => {
    const url = trimTrailingPunctuation(rawUrl);
    if (seenLinks.has(url) || excluded.has(url)) return;
    // 확장자가 이미지면 링크 목록이 아니라 이미지로 취급 — 본문에 맨몸으로
    // 박힌 포스터 URL이 "링크"로 보이면 사용자가 신청 링크로 오해한다.
    if (IMAGE_EXT_RE.test(url)) {
      if (!seenImages.has(url)) {
        seenImages.add(url);
        images.push({ url, alt: '' });
      }
      return;
    }
    seenLinks.add(url);
    links.push({ url, text: text?.trim() || null, domain: toDomain(url) });
  };

  const pushEmail = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!seenEmails.has(value)) {
      seenEmails.add(value);
      emails.push(value);
    }
  };

  masked = masked.replace(MD_LINK_RE, (_m, text: string, url: string) => {
    if (url.startsWith('mailto:')) pushEmail(url.slice(7));
    else if (/^https?:\/\//i.test(url)) pushLink(url, text);
    return ' ';
  });

  // 3) 남은 맨몸 URL
  masked = masked.replace(BARE_URL_RE, (m: string) => {
    pushLink(m, null);
    return ' ';
  });

  // 4) 이메일 — 링크가 지워진 뒤라 mailto 중복이 없다.
  for (const m of masked.matchAll(EMAIL_RE)) pushEmail(m[0]);

  // 5) 전화
  const phones: string[] = [];
  const seenPhones = new Set<string>();
  for (const m of markdown.matchAll(PHONE_RE)) {
    const value = normalizePhone(m[1], m[2], m[3]);
    if (!seenPhones.has(value)) {
      seenPhones.add(value);
      phones.push(value);
    }
  }

  return { images, links, emails, phones };
}
