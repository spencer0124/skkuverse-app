import { describe, it, expect } from 'vitest';
import { parseCampusResponse } from '../parser';

/**
 * The campus feed's banner carousel reuses the home carousel's parser; these
 * cases pin what the campus side adds on top: images only, and a malformed
 * section degrading to `unknown` rather than taking the feed down.
 */

const image = {
  type: 'image',
  id: 'eskara-2026-banner-01',
  imageUrl: 'https://media.skkuverse.com/campus/banners/eskara-2026-01-00000000.webp',
  alt: '청랑 현수막',
};

const grid = {
  type: 'button_grid',
  id: 'campus_buttons',
  columns: 4,
  items: [{ id: 'inquiry', title: '문의하기', emoji: '💬', actionType: 'external', actionValue: 'https://x' }],
};

function feed(...sections: unknown[]) {
  return parseCampusResponse({ meta: { lang: 'ko' }, data: { minAppVersion: '2.0.0', sections } } as never);
}

describe('parseCampusResponse — banner_carousel', () => {
  it('parses the server payload ahead of the tiles', () => {
    const carousel = { type: 'banner_carousel', id: 'campus_banners', aspectRatio: 6, autoRotateSec: 4, items: [image] };
    const { sections } = feed(carousel, grid);
    expect(sections.map((s) => s.type)).toEqual(['banner_carousel', 'button_grid']);
    expect(sections[0]).toEqual({
      type: 'banner_carousel',
      id: 'campus_banners',
      aspectRatio: 6,
      autoRotateSec: 4,
      items: [{ type: 'image', id: image.id, imageUrl: image.imageUrl, alt: image.alt }],
    });
  });

  it('drops a default item, which only the home screen can draw', () => {
    const carousel = { type: 'banner_carousel', id: 'c', aspectRatio: 6, autoRotateSec: 4, items: [{ type: 'default' }, image] };
    const [section] = feed(carousel).sections;
    expect(section).toMatchObject({ items: [{ type: 'image', id: image.id }] });
  });

  it('keeps a non-https image out of the rotation', () => {
    const carousel = {
      type: 'banner_carousel',
      id: 'c',
      aspectRatio: 6,
      autoRotateSec: 4,
      items: [{ ...image, imageUrl: 'http://media.skkuverse.com/a.webp' }],
    };
    expect(feed(carousel).sections[0]).toMatchObject({ items: [] });
  });

  it('degrades a carousel with no id to unknown, leaving the tiles', () => {
    const { sections } = feed({ type: 'banner_carousel', items: [image] }, grid);
    expect(sections.map((s) => s.type)).toEqual(['unknown', 'button_grid']);
  });
});
