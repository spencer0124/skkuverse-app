/**
 * The campus sheet's chrome, as a function of how far it has been dragged.
 *
 * On iOS 26 the sheet is a floating Liquid Glass card at the low detents and an
 * ordinary opaque sheet at the top one, the way Apple Maps and Find My behave:
 * the side gaps tighten, the corners square up a little and the glass turns
 * solid as the sheet is dragged up. All three are one continuous function of
 * gorhom's `animatedIndex`, so they track the finger instead of flipping at a
 * threshold.
 *
 * Pure and import-free so it runs both inside a Reanimated worklet and under
 * plain `node --test`. The `'worklet'` directive is what lets `useAnimatedStyle`
 * call it on the UI thread; under Node it is an inert string literal.
 */

/**
 * The card's side and bottom gap at the collapsed detent.
 *
 * Small on purpose. The card is meant to read as a sheet that has lifted a
 * little off the screen, not as a panel sized to the tab bar below it — pulling
 * it all the way in to the tab bar's own 21pt rail makes it look shrunken.
 */
export const SHEET_FLOAT_INSET = 8;

/**
 * Corner radius while the card floats.
 *
 * 32 is the iOS 26 tab bar's own corner, measured off a device screenshot: the
 * tab bar is a capsule about 64 tall, so its corners turn at 32. Matching it
 * makes the two floating surfaces at the bottom of this screen share one curve,
 * which is what stops them reading as unrelated panels. Their WIDTHS are
 * deliberately not matched — see `SHEET_FLOAT_INSET`. UIKit draws both
 * continuous rather than circular.
 */
export const SHEET_RADIUS_FLOATING = 32;

/**
 * Corner radius once the sheet is attached.
 *
 * 20 because that is what `SheetHandle` painted before this existed — the top
 * detent has to be indistinguishable from the sheet that shipped, or the change
 * is a redesign of the expanded state as well.
 */
export const SHEET_RADIUS_ATTACHED = 20;

/**
 * The display's own corner radius, in points.
 *
 * It exists because of a rule that only bites at the bottom of the screen: a
 * rounded rect inset by `i` stays inside a display of radius `R` only while its
 * own corner radius is at least `R - i`. A tighter corner bulges past the
 * display's curve and the OS mask slices it off, which reads as the card being
 * cut by the screen rather than floating above it. Tighter still and the gap
 * pinches shut at the diagonal while the straight edges keep their full inset.
 *
 * 62 is the value for the 402x874 screen this was built against, and the
 * largest in the iOS 26 device set. Deliberately the largest: overshooting on a
 * device with a tighter corner only sets the card's corner a little inside the
 * screen's, which is invisible, while undershooting clips. Do NOT try to derive
 * it from the tab bar — that was the first attempt and it is wrong, because the
 * tab bar is a capsule whose radius is forced by its own height rather than
 * chosen to nest inside the display.
 */
export const DISPLAY_CORNER_RADIUS = 62;

export interface SheetChrome {
  /** Side and bottom gap, px. 0 once attached. */
  inset: number;
  /** Top corner radius, px — the design value, matched to the tab bar. */
  radius: number;
  /**
   * Bottom corner radius, px. Larger than `radius`, because these two corners
   * sit inside the display's own and have to stay concentric with it.
   */
  bottomRadius: number;
  /** 0 = pure glass, 1 = opaque white. */
  fillOpacity: number;
}

const ATTACHED: SheetChrome = {
  inset: 0,
  radius: SHEET_RADIUS_ATTACHED,
  bottomRadius: DISPLAY_CORNER_RADIUS,
  fillOpacity: 1,
};

/**
 * Chrome for a given sheet position.
 *
 * `index` is gorhom's `animatedIndex` and `lastIndex` is `snapPoints.length - 1`,
 * passed rather than hardcoded so adding a fourth detent moves the endpoint with
 * it instead of leaving a stale `2` behind.
 *
 * ## Why the negative branch clamps rather than short-circuits
 *
 * `animatedIndex` goes below 0 in two unrelated situations, and they want
 * opposite answers. Over-dragging the sheet downward past its lowest detent
 * pushes it slightly negative while the card is plainly visible — snapping to
 * the attached geometry there would flash an opaque full-width sheet under the
 * user's finger. Gorhom also reports a hard `-1` for every frame before its
 * first layout. So this clamps (keeping the floating card during an over-drag),
 * and the pre-layout case is handled by the caller, which knows whether the
 * container has been measured. `SheetBackground` renders the plain attached
 * background until `containerHeight` arrives.
 */
export function sheetChromeAt(index: number, lastIndex: number): SheetChrome {
  'worklet';
  // A single-detent sheet has no expanded state to travel toward, so there is
  // no meaningful float. Degrade to the plain sheet rather than inventing one.
  if (lastIndex <= 0) {
    return ATTACHED;
  }

  // Geometry spans the whole travel, so the gaps tighten across every detent.
  const t = index <= 0 ? 0 : index >= lastIndex ? 1 : index / lastIndex;

  // The fill only ramps over the FINAL segment. Dissolving the glass from the
  // first detent onward would leave the middle detent a muddy half-opaque
  // panel, which is neither of the two states this is supposed to have.
  const raw = index - (lastIndex - 1);
  const fillOpacity = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;

  const inset = SHEET_FLOAT_INSET * (1 - t);
  const radius =
    SHEET_RADIUS_FLOATING + (SHEET_RADIUS_ATTACHED - SHEET_RADIUS_FLOATING) * t;

  return {
    inset,
    radius,
    // Concentric with the display, never tighter than the top corners. Without
    // this the bottom corners are cut off by the screen's own rounding instead
    // of tracing it.
    bottomRadius: Math.max(radius, DISPLAY_CORNER_RADIUS - inset),
    fillOpacity,
  };
}
