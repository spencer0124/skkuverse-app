/** WHY: binary formats the in-app browser cannot render, so they only download. */
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

function getExtension(name: string): string {
  return (name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
}

export function canPreview(name: string): boolean {
  return !NO_PREVIEW_EXTS.has(getExtension(name));
}

/** WHY: some department servers block hotlinks, so the proxy adds the Referer and gnuboard's PHPSESSID. */
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
