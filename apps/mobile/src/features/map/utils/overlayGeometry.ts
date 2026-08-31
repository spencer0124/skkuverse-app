/**
 * Wire geometry → what `NaverMapPolygonOverlay` and `NaverMapPathOverlay` want.
 *
 * ## Why this is here and not in @skkuverse/shared
 *
 * `map/geometry.ts` over in shared owns the WIRE's convention: it renames a
 * GeoJSON `[lng, lat]` position to `{ lat, lng }`, once, and nothing downstream
 * ever sees the tuple. This file owns the SDK's convention — the field
 * spelling, and the ring winding Naver wants — which is a rendering detail of
 * one library on one platform. Putting the reversal in shared would bake a
 * Naver quirk into the data layer that the web surfaces also read from.
 *
 * ## The reversal, and why it is unconditional
 *
 * The wire is wound per RFC 7946 §3.1.6 — exterior counter-clockwise, holes
 * clockwise — and the server normalises it on the way out (`geo/ring-winding.ts`),
 * so the direction is a guarantee. `NaverMapPolygonOverlay` documents the
 * opposite: 시계 방향 for `coords`, 시계 반대 방향 for `holes`.
 * <!-- conventions:allow-korean: the SDK's own prop documentation -->
 *
 * A known direction is reversed, not measured. Adding a shoelace here would be
 * a second implementation of a fact the producer already asserted, free to
 * disagree with it — and the failure it would introduce is the nastiest kind
 * available: a wrongly wound ring frequently still DRAWS and merely stops
 * receiving events, so the zone looks right and silently refuses every tap.
 *
 * Imports only TYPES, so `--experimental-strip-types` erases them and
 * `overlayGeometry.test.mts` loads under plain Node with no SDK at runtime.
 */

import type { Coord } from '@mj-studio/react-native-naver-map';
import type { LatLng } from '@skkuverse/shared';

/** The wire's positions in the SDK's spelling. Order is preserved; nothing else changes. */
export function toNaverCoords(points: readonly LatLng[]): Coord[] {
  return points.map(({ lat, lng }) => ({ latitude: lat, longitude: lng }));
}

/**
 * A polygon's rings, reversed into the winding the SDK wants.
 *
 * `rings[0]` is the exterior and the rest are holes, which is RFC 7946's own
 * layout. One reversal serves both roles because the two conventions are
 * mirror images of each other: exterior CCW→CW and holes CW→CCW are the same
 * operation applied to each ring.
 *
 * `null` for a polygon with no rings. Unreachable from the parser, which drops
 * such an overlay, but it keeps the component's "nothing to draw" branch
 * explicit rather than handing the SDK an empty `coords` array — which its own
 * docs say is not added to the map, silently.
 */
export function toPolygonGeometry(
  rings: readonly LatLng[][],
): { coords: Coord[]; holes: Coord[][] } | null {
  const [outer, ...holes] = rings;
  if (!outer) return null;
  // `.reverse()` mutates, and that is safe precisely because `toNaverCoords`
  // returns a freshly mapped array every time — never the caller's input.
  return {
    coords: toNaverCoords(outer).reverse(),
    holes: holes.map((ring) => toNaverCoords(ring).reverse()),
  };
}

/** Bare or `#`-prefixed hex, 3 or 6 digits — the two forms an alpha can be appended to. */
const RGB_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * A CSS colour plus a fill opacity, as `#RRGGBBAA`.
 *
 * Needed because `NaverMapPolygonOverlay.color` defaults to OPAQUE BLACK: a
 * zone drawn without an alpha is not a subtle mistake, it is a black rectangle
 * over the booths the zone exists to group. The server sends `fillOpacity` as a
 * separate field rather than an eight-digit hex, because `color` is shared with
 * the marker and path layers where an opacity would be meaningless.
 *
 * Composed onto the string rather than parsed into channels. The helper this
 * replaced (`MapPolylineLayer`'s `hexToRgba`) called `parseInt` on substrings
 * and produced `rgba(NaN,NaN,NaN,1)` — an invisible overlay — for every value
 * that was not exactly six digits, including the bare hex the server actually
 * sends and every design token used as a fallback. Anything this cannot
 * decompose is returned UNCHANGED, so the worst case is a colour at full
 * strength rather than a shape that vanishes.
 *
 * An absent opacity means the server said nothing, which is not the same as 1
 * — it means leave the colour alone.
 */
export function withAlpha(css: string, opacity: number | undefined): string {
  if (opacity === undefined || !Number.isFinite(opacity)) return css;
  const match = RGB_HEX_RE.exec(css);
  if (!match) return css;

  const digits = match[1]!;
  // `#abc` is shorthand for `#aabbcc`; appending two digits to it would produce
  // the four-digit `#RGBA` form, where the alpha byte would be read as one
  // nibble and the colour would change as well as its opacity.
  const rgb =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;

  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${alpha}`;
}
