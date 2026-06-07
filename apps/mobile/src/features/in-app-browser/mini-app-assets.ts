/**
 * Mini-app logo bindings — the ONLY place with `require()` literals (Metro needs
 * static string args, so they can't live in the registry JSON). Keyed by the
 * registry `logo.key` (= slug, by convention key === id). When the registry goes
 * server-driven, logos arrive as `{ kind: 'remote', uri }` and bypass this map.
 *
 * `require()` returns a numeric Metro asset id, hence `Record<string, number>`.
 */
import type { ImageSourcePropType } from 'react-native';
import type { MiniAppLogo } from '@skkuverse/shared';

export const MINI_APP_LOGO_ASSETS: Record<string, number> = {
  skkuzine: require('../../../assets/mini-app-logos/scaa.jpg'),
  skkuw: require('../../../assets/mini-app-logos/sungdaenews.png'),
  hssc: require('../../../assets/mini-app-logos/speak.webp'),
  nsc: require('../../../assets/mini-app-logos/speak.webp'),
};

/** Full RN Image source (bundled number | remote uri) — for `<Image>`. */
export function resolveMiniAppLogo(logo: MiniAppLogo): ImageSourcePropType | undefined {
  return logo.kind === 'bundled' ? MINI_APP_LOGO_ASSETS[logo.key] : { uri: logo.uri };
}

/** Bundled asset number for the home grid (`imageSource?: number`). undefined if remote. */
export function miniAppTileImage(logo: MiniAppLogo): number | undefined {
  return logo.kind === 'bundled' ? MINI_APP_LOGO_ASSETS[logo.key] : undefined;
}

/** Bundled logo number for a slug (id-only call sites; assumes key === id). */
export function miniAppLogoNumber(id: string): number | undefined {
  return MINI_APP_LOGO_ASSETS[id];
}
