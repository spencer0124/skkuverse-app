/**
 * Snapshot icon spec → a Naver map `image` prop.
 *
 * Lives in the app rather than packages/shared because `MarkerSymbol` is the map
 * SDK's union and shared must not depend on the SDK. The wire type is
 * `{ kind: 'symbol'; symbol: string }` — an OPEN string — so the allowlist has to
 * sit on this side of that seam.
 *
 * Resolution is by `kind`. `docs/explanation/eventmap-rendering.md` §6.3 used to
 * say the image is `{httpUri}` from the icons dict; following that literally
 * would land every ESKARA pin on the green fallback, because the live config
 * ships symbol icons exclusively and colour is the entire visual
 * differentiation: bar red, booth blue, food yellow, stage pink, facility
 * lightblue, and every `*_off` gray.
 */

import type { MapImageProp, MarkerSymbol } from '@mj-studio/react-native-naver-map';
import type { IconSpec } from '@skkuverse/shared';

/**
 * The SDK's full `MarkerSymbol` union. ESKARA uses seven of these (blue, gray,
 * green, lightblue, pink, red, yellow); the cluster entries are here only so the
 * allowlist matches the type rather than a subset of it.
 */
const MARKER_SYMBOLS: ReadonlySet<string> = new Set<MarkerSymbol>([
  'blue',
  'gray',
  'green',
  'lightblue',
  'pink',
  'red',
  'yellow',
  'black',
  'lowDensityCluster',
  'mediumDensityCluster',
  'highDensityCluster',
]);

export interface ResolvedIcon {
  image: MapImageProp;
  /** Only set for remote art; symbols size themselves. */
  width?: number;
  height?: number;
}

/** The SDK's own default, so an unrenderable icon still leaves a tappable pin. */
const FALLBACK: ResolvedIcon = { image: { symbol: 'green' } };

export function resolveIcon(
  icons: Record<string, IconSpec>,
  iconId: string | null | undefined,
): ResolvedIcon {
  const spec = iconId ? icons[iconId] : undefined;
  if (!spec) return FALLBACK;

  if (spec.kind === 'symbol') {
    // An unknown symbol string would render nothing at all on native, so it has
    // to fall back rather than pass through.
    return MARKER_SYMBOLS.has(spec.symbol)
      ? { image: { symbol: spec.symbol as MarkerSymbol } }
      : FALLBACK;
  }

  if (spec.kind === 'remote') {
    // width/height are passed through deliberately: the SDK sizes an httpUri
    // marker from the downloaded bitmap otherwise, which differs between debug
    // and release builds.
    return { image: { httpUri: spec.uri }, width: spec.width, height: spec.height };
  }

  return FALLBACK;
}
