/**
 * Previews and the hotlink proxy URL, over the production fixture's attachment.
 */
import { describe, expect, it } from 'vitest';
import detail from './__fixtures__/notice-detail.json';
import { buildAttachmentUrl, canPreview, isImageAttachment } from './attachment.rules';

const attachment = detail.data.attachments[0]!;

describe('the fixture attachment', () => {
  it('is an archive with an uppercase extension, read case-insensitively, so it only downloads', () => {
    // Assert
    expect(canPreview(attachment.name)).toBe(false);
  });

  it('opens through the proxy with its notice page as the referer', () => {
    // Act
    const url = buildAttachmentUrl(attachment.url, detail.data.sourceUrl, 'download', attachment.name);

    // Assert
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      'https://files.skkuverse.com/notices/proxy/attachment',
    );
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      url: attachment.url,
      referer: detail.data.sourceUrl,
      mode: 'download',
      name: attachment.name,
    });
  });

  it('leaves the name off an inline proxy URL that has none', () => {
    // Act
    const url = buildAttachmentUrl('https://x.skku.edu/a.pdf', 'https://x.skku.edu/n', 'inline');

    // Assert
    expect(url).toBe(
      'https://files.skkuverse.com/notices/proxy/attachment?url=https%3A%2F%2Fx.skku.edu%2Fa.pdf&referer=https%3A%2F%2Fx.skku.edu%2Fn&mode=inline',
    );
  });
});

describe('previews', () => {
  it('previews all but binary documents', () => {
    // Assert
    expect(canPreview('a.pdf')).toBe(true);
    expect(canPreview('a.hwp')).toBe(false);
    expect(canPreview('README')).toBe(true);
  });
});

describe('isImageAttachment', () => {
  it.each([
    ['poster.jpg', 'https://x.skku.edu/download.do?id=1', true],
    ['poster.JPEG', 'https://x.skku.edu/download.do?id=1', true],
    ['a.png', 'https://x.skku.edu/a', true],
    ['a.gif', 'https://x.skku.edu/a', true],
    ['a.webp', 'https://x.skku.edu/a', true],
    ['a.HEIC', 'https://x.skku.edu/a', true],
    ['a.heif', 'https://x.skku.edu/a', true],
    ['a.pdf', 'https://x.skku.edu/a.png', false],
    ['a.svg', 'https://x.skku.edu/a', false],
    ['a.png.zip', 'https://x.skku.edu/a', false],
    ['포스터', 'https://x.skku.edu/files/poster.PNG?v=2', true],
    ['포스터', 'https://x.skku.edu/download.do?file=poster.png', false],
    ['포스터', 'not a url', false],
  ])('reads %s at %s as an image: %s', (name, url, isImage) => {
    // Act & Assert
    expect(isImageAttachment({ name, url })).toBe(isImage);
  });
});
