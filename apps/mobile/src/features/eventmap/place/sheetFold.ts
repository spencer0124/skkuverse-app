/**
 * Where the place sheet's collapsed card ends, in content coordinates.
 *
 * The sheet has one layout for both detents — a summary, then tabs — because
 * `docs/explanation/bottom-sheet-system.md` rules out branching content on the
 * detent. What the user asked for is that the collapsed card shows the summary
 * and not the tabs, so the summary is given a minimum height that reaches the
 * collapsed card's bottom edge: the tab bar then always starts below the fold,
 * whatever the summary happens to contain.
 *
 * Imports nothing, so `sheetFold.test.mts` can load it under plain Node.
 *
 * ## The arithmetic
 *
 * The peek sheet is a crossfading modal: its container is the window, its
 * `bottomInset` is 0, and a percentage detent resolves against the window. The
 * card at that detent is the snap height less the gap the card floats above the
 * screen's bottom edge; the scroll content starts below the handle and the
 * pinned header.
 */

export interface FoldInput {
  /** The sheet's container height — the window, for a modal. */
  containerHeight: number;
  /** The collapsed detent as a percentage of the container, e.g. 45. */
  detentPercent: number;
  /** Gap between the floating card's bottom edge and the screen's. */
  bottomGap: number;
  /** Everything in the card above the scroll content: handle plus pinned header. */
  chromeAbove: number;
}

/** The collapsed detent's height as gorhom sees it, in points. */
export function detentHeight(containerHeight: number, detentPercent: number): number {
  return (containerHeight * detentPercent) / 100;
}

/**
 * How much scroll content the collapsed card shows.
 *
 * Floored and never negative: a landscape phone can make the chrome taller
 * than the detent, and a negative minimum height is not a layout.
 */
export function collapsedContentHeight(input: FoldInput): number {
  const { containerHeight, detentPercent, bottomGap, chromeAbove } = input;
  return Math.max(0, Math.floor(detentHeight(containerHeight, detentPercent) - bottomGap - chromeAbove));
}

/**
 * The collapsed snap height for a sheet that ends at its summary.
 *
 * A place with no tabs — a toilet — has nothing to drag up to, so the default
 * detent would leave most of the card as empty glass. The sheet is shrunk to
 * its content instead, but never grown past the default: a long summary still
 * collapses to the usual height and scrolls.
 *
 * `null` until the content has been measured, which tells the caller to keep
 * the default rather than snap to a guess.
 */
export function fittedDetentHeight(
  input: FoldInput & { contentHeight: number | null },
): number | null {
  const { contentHeight, containerHeight, detentPercent, chromeAbove } = input;
  if (contentHeight === null || contentHeight <= 0) return null;
  // `contentHeight` already includes the scroll view's bottom padding, which
  // pays for `bottomGap` itself — see EventMapPeekSheet.
  const fitted = Math.ceil(chromeAbove + contentHeight);
  return Math.min(fitted, Math.floor(detentHeight(containerHeight, detentPercent)));
}
