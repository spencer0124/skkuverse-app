/**
 * The home layout the app draws before it has ever heard from the server, or
 * when `GET /ui/home` fails with nothing cached.
 *
 * A copy of what skkuverse-server's `src/ui/home/home-layout.json` serves
 * today, so a first launch offline looks like every other launch rather than
 * like an older app. The server stays the source of truth: any response, or a
 * cached one, replaces this entirely. Update it alongside the server file when
 * the layout changes for long enough to matter; a stale copy only shows in the
 * offline-first-launch case, and the grids are still joined against the
 * registry, so an id the registry drops is skipped here too.
 *
 * Text comes from the app's own translations, because the server localizes
 * its copy per request and this one has to cover every language at once.
 */
import type { TranslationKey } from '../i18n/translations';
import type { HomeLayout } from './schema';

export function defaultHomeLayout(t: (key: TranslationKey) => string): HomeLayout {
  return {
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
            id: 'eskara-2026-panorama',
            imageUrl:
              'https://media.skkuverse.com/home/banners/eskara-2026-panorama-b9ed45de.jpg',
            alt: t('home.banner.eskaraAlt'),
            action: { actionType: 'miniapp', actionValue: 'eskara-2026' },
          },
          { type: 'default' },
        ],
      },
      {
        type: 'miniapp_grid',
        id: 'main',
        title: t('home.tile.eskara'),
        miniAppIds: ['eskara-2026', 'mukja', 'playlist', 'booth-box'],
      },
      {
        type: 'miniapp_grid',
        id: 'games',
        title: t('home.section.miniGames'),
        miniAppIds: ['subway-typing', 'wave-run'],
      },
    ],
  };
}
