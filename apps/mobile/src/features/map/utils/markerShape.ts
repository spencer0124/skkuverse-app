/**
 * What a place marker draws, how big it is, and where it hangs.
 *
 * Naver Map's own behaviour, and the reason this axis exists: a dense strip of
 * teardrops is unreadable, so the default marker is a small circle and only the
 * SELECTED one is promoted to a pin. At the 대운동장 west strip that is ~40
 * markers in two columns, where a 22×30 teardrop each overlaps its neighbours
 * and a caption almost never survives collision.
 *
 * Pure, and separated from the render loop for one reason above the others: the
 * ANCHOR has to move with the shape. A teardrop hangs by its tip and a disc by
 * its centre, so swapping the image on selection without swapping the anchor
 * slides the marker off the coordinate it exists to mark — silently, and only
 * for the marker the user is currently looking at.
 *
 * Imports only a TYPE from @skkuverse/shared, so `--experimental-strip-types`
 * erases it and `markerShape.test.mts` loads under plain Node.
 */

import type { MarkerShape } from '@skkuverse/shared';

/**
 * The shape a layer gets when `/map/config` does not name one.
 *
 * Deliberately not `'pin'`. The dot is what this axis was added to make the
 * default, so a server predating `style.shape` gets the new behaviour rather
 * than being frozen on the old look forever.
 */
const DEFAULT_SHAPE: MarkerShape = 'dotThenPin';

/**
 * Geometry fallbacks, for a server that does not send `style` geometry.
 *
 * `PIN_WIDTH`/`PIN_HEIGHT` are the tintable base icon's natural proportions, so
 * the tint is not distorted. They were `MapOverlayLayer`'s constants before the
 * wire carried them, and the live config sends exactly these.
 */
export const PIN_WIDTH = 22;
export const PIN_HEIGHT = 30;

/** The visible diameter of an unselected dot, in points. */
export const DOT_DIAMETER = 18;

/**
 * How much bigger the dot asset's canvas is than the disc drawn inside it.
 *
 * `marker-dot.png` carries transparent padding — 5pt around an 18pt disc on a
 * 28pt canvas — and that padding is the tap target, not slack. A bare 14pt core
 * is a miserable thing to hit with a thumb, and Naver sizes a marker's touch
 * area from its icon rather than from its opaque pixels.
 *
 * A ratio rather than a second constant, for the same reason `DOT_TEXT_RATIO` is
 * one: `size` is the server's to set, and a hardcoded canvas beside a
 * server-driven disc is exactly the half-honouring that makes wire geometry
 * decorative. The two cannot drift.
 */
export const DOT_CANVAS_RATIO = 28 / 18;

/** What the overlay actually needs to draw one marker. */
export interface MarkerGeometry {
  /** Which image to use: the tintable teardrop, or the tintable disc. */
  kind: 'pin' | 'dot';
  /** Overlay width in points. For a dot this is the PADDED canvas, not the disc. */
  width: number;
  /** Overlay height in points. */
  height: number;
  /** A teardrop hangs by its tip (1), a disc by its centre (0.5). */
  anchorY: number;
}

/** The `MapLayerStyle` members this reads. Narrowed so the tests need no config. */
type StyleGeometry = {
  width?: number;
  height?: number;
  size?: number;
};

function kindOf(shape: MarkerShape | undefined, isSelected: boolean): 'pin' | 'dot' {
  switch (shape ?? DEFAULT_SHAPE) {
    case 'pin':
      return 'pin';
    case 'dot':
      return 'dot';
    case 'dotThenPin':
      return isSelected ? 'pin' : 'dot';
  }
}

export function resolveMarkerGeometry(
  shape: MarkerShape | undefined,
  isSelected: boolean,
  style: StyleGeometry | undefined,
): MarkerGeometry {
  const pinWidth = style?.width ?? PIN_WIDTH;
  const kind = kindOf(shape, isSelected);

  if (kind === 'pin') {
    return {
      kind,
      width: pinWidth,
      height: style?.height ?? PIN_HEIGHT,
      anchorY: 1,
    };
  }

  // A selected disc borrows the PIN's width for its diameter rather than
  // carrying a scale factor of its own. One wire field then sizes the selected
  // marker whatever shape it takes, so a server that grows the pin grows the
  // selected dot with it and the two cannot disagree about what "selected" is.
  const visible = isSelected ? pinWidth : (style?.size ?? DOT_DIAMETER);
  const canvas = visible * DOT_CANVAS_RATIO;
  return { kind, width: canvas, height: canvas, anchorY: 0.5 };
}
