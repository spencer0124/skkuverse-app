import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUTO_ROTATE_SEC,
  DEFAULT_BANNER_ASPECT_RATIO,
  parseHomeLayout,
} from '../schema';

/**
 * The server validates its own layout at boot; this side must instead degrade.
 * Every case is "the server sent something this build does not expect — does
 * the home screen still render?"
 */

const image = {
  type: 'image',
  id: 'eskara',
  imageUrl: 'https://media.skkuverse.com/home/banners/eskara-00000000.jpg',
  alt: 'ESKARA',
  actionType: 'miniapp',
  actionValue: 'eskara-2026',
};

const carousel = {
  type: 'banner_carousel',
  id: 'home_top',
  aspectRatio: 2.25,
  autoRotateSec: 5,
  items: [image, { type: 'default' }],
};

const grid = { type: 'miniapp_grid', id: 'games', title: '미니게임', miniAppIds: ['wave-run'] };

describe('parseHomeLayout', () => {
  it('parses the server payload', () => {
    expect(parseHomeLayout({ version: 1, sections: [carousel, grid] })).toEqual({
      version: 1,
      sections: [
        {
          type: 'banner_carousel',
          id: 'home_top',
          aspectRatio: 2.25,
          autoRotateSec: 5,
          items: [
            {
              type: 'image',
              id: 'eskara',
              imageUrl: image.imageUrl,
              alt: 'ESKARA',
              action: { actionType: 'miniapp', actionValue: 'eskara-2026' },
            },
            { type: 'default' },
          ],
        },
        grid,
      ],
    });
  });

  it('returns null for a payload that is not a layout', () => {
    expect(parseHomeLayout(null)).toBeNull();
    expect(parseHomeLayout({ version: 1 })).toBeNull();
    expect(parseHomeLayout([])).toBeNull();
  });

  it('skips section and banner item types newer than this build', () => {
    const layout = parseHomeLayout({
      version: 1,
      sections: [
        { type: 'video_hero', id: 'x' },
        { ...carousel, items: [{ type: 'lottie', id: 'y' }, { type: 'default' }] },
      ],
    });
    expect(layout?.sections).toHaveLength(1);
    expect(layout?.sections[0]).toMatchObject({ items: [{ type: 'default' }] });
  });

  it('drops a banner with no usable image, keeps one with an unknown action inert', () => {
    const layout = parseHomeLayout({
      version: 1,
      sections: [
        {
          ...carousel,
          items: [
            { ...image, id: 'a', imageUrl: 'http://insecure.example/a.jpg' },
            { ...image, id: 'b', imageUrl: undefined },
            { ...image, id: 'c', actionType: 'teleport' },
          ],
        },
      ],
    });
    const items = (layout?.sections[0] as { items: unknown[] }).items;
    expect(items).toEqual([{ type: 'image', id: 'c', imageUrl: image.imageUrl, alt: 'ESKARA' }]);
  });

  it('falls back to defaults for an out-of-range slot shape or rotation', () => {
    const layout = parseHomeLayout({
      version: 1,
      sections: [{ ...carousel, aspectRatio: 0, autoRotateSec: 1 }],
    });
    expect(layout?.sections[0]).toMatchObject({
      aspectRatio: DEFAULT_BANNER_ASPECT_RATIO,
      autoRotateSec: DEFAULT_AUTO_ROTATE_SEC,
    });
  });

  it('keeps autoRotateSec 0 as "off"', () => {
    const layout = parseHomeLayout({ version: 1, sections: [{ ...carousel, autoRotateSec: 0 }] });
    expect(layout?.sections[0]).toMatchObject({ autoRotateSec: 0 });
  });

  it('drops a grid with no ids and omits a blank title', () => {
    const layout = parseHomeLayout({
      version: 1,
      sections: [
        { ...grid, miniAppIds: [] },
        { ...grid, id: 'main', title: '', miniAppIds: ['mukja', 3] },
      ],
    });
    expect(layout?.sections).toEqual([{ type: 'miniapp_grid', id: 'main', miniAppIds: ['mukja'] }]);
  });
});
