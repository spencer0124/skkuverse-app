import { describe, it, expect } from 'vitest';
import { translations } from '../../i18n/translations';
import { defaultHomeLayout } from '../defaults';
import { parseHomeLayout } from '../schema';

/**
 * The bundled default is drawn exactly like a server response, so it must be
 * one: re-serialized to the wire shape (actions flattened) and parsed back,
 * nothing may be lost.
 */
describe('defaultHomeLayout', () => {
  it.each(['ko', 'en', 'zh'] as const)('is a layout the parser accepts unchanged (%s)', (lang) => {
    const layout = defaultHomeLayout((key) => translations[lang][key]);
    const wire = {
      ...layout,
      sections: layout.sections.map((section) =>
        section.type === 'banner_carousel'
          ? {
              ...section,
              items: section.items.map((item) =>
                item.type === 'image' && item.action
                  ? { ...item, action: undefined, ...item.action }
                  : item,
              ),
            }
          : {
              ...section,
              tiles: section.tiles.map((tile) =>
                tile.kind === 'link' ? { ...tile, action: undefined, ...tile.action } : tile,
              ),
            },
      ),
    };
    expect(parseHomeLayout(JSON.parse(JSON.stringify(wire)))).toEqual(layout);
  });
});
