/**
 * 첨부파일 URL/종류 판별.
 *
 * `NoticeDetailScreen` 안에 있던 module-private 헬퍼를 꺼낸 것 — 첨부 목록이
 * 별도 컴포넌트(`NoticeAttachments`)로 분리되면서 썸네일 URL을 만들 곳이
 * 화면 바깥으로 옮겨갔다.
 */

/**
 * 미리보기를 지원하지 않는 확장자.
 *
 * 인앱 브라우저(WebBrowser)가 렌더하지 못하는 바이너리 포맷들. 여기 속하면
 * 미리보기 대신 안내 토스트를 띄우고 다운로드만 제공한다.
 */
const NO_PREVIEW_EXTS = new Set([
  '.hwp',
  '.hwpx',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
]);

/**
 * 썸네일을 시도할 확장자.
 *
 * 서버 프록시의 `EXT_MIME` 맵(skkuverse-server `src/notices/notices.controller.ts`)에
 * 들어 있는 이미지 타입만 넣는다. upstream이 구체적인 content-type을 안 줄 때
 * 프록시는 이 맵으로 폴백하는데, **`.webp`는 맵에 없어서**
 * `application/octet-stream`으로 내려가고 `<Image>`가 로드에 실패한다.
 * 서버 맵이 늘면 여기도 같이 늘려야 한다.
 */
const THUMBNAIL_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif']);

export type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'slide'
  | 'archive'
  | 'other';

/** 파일명에서 소문자 확장자(".pdf"). 없으면 빈 문자열. */
export function getExtension(name: string): string {
  return (name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
}

export function canPreview(name: string): boolean {
  return !NO_PREVIEW_EXTS.has(getExtension(name));
}

export function canThumbnail(name: string): boolean {
  return THUMBNAIL_EXTS.has(getExtension(name));
}

export function getAttachmentKind(name: string): AttachmentKind {
  const ext = getExtension(name);
  if (THUMBNAIL_EXTS.has(ext) || ext === '.webp' || ext === '.bmp') return 'image';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.hwp' || ext === '.hwpx' || ext === '.doc' || ext === '.docx') return 'doc';
  if (ext === '.xls' || ext === '.xlsx' || ext === '.csv') return 'sheet';
  if (ext === '.ppt' || ext === '.pptx') return 'slide';
  if (ext === '.zip' || ext === '.rar' || ext === '.7z') return 'archive';
  return 'other';
}

/** 확장자 배지 문구("PDF"). 확장자가 없으면 null. */
export function getExtensionLabel(name: string): string | null {
  const ext = getExtension(name);
  return ext ? ext.slice(1).toUpperCase() : null;
}

/**
 * 첨부파일 프록시 URL.
 *
 * 일부 SKKU 학과 서버가 hotlink 차단을 걸어 두어 원본 URL을 직접 열면 실패한다.
 * 프록시가 `Referer`(+ gnuboard PHPSESSID)를 붙여 대신 받아온다. 허용 호스트는
 * 서버에서 `*.skku.edu` / `*.skkumed.ac.kr`로 제한돼 있다.
 */
export function buildAttachmentUrl(
  url: string,
  sourceUrl: string,
  mode: 'inline' | 'download',
  name?: string,
): string {
  const params = new URLSearchParams({ url, referer: sourceUrl, mode });
  if (name) params.set('name', name);
  return `https://files.skkuverse.com/notices/proxy/attachment?${params.toString()}`;
}
