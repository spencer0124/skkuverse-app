/**
 * How tall the place sheet's collapsed card is.
 *
 * One rule for every place: the default mid-size detent, unless the whole sheet
 * is shorter than that, in which case the card shrinks to fit.
 *
 * This replaced two competing paths. One padded the summary out to the fold so
 * the sections started below it, which left a band of nothing whenever the
 * summary was short. The other shrank the card to its content, but only for a
 * place that had no sections at all. The padding is gone — the summary carries
 * no minimum height, so the facts card starts right below it and fills the
 * card — and the shrink now applies to every place on the same terms.
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
 * The collapsed snap height for a place sheet.
 *
 * **The default detent is the answer for almost every place.** It is a mid-size
 * card — `SHEET_DETENT_PERCENT.small` of the window — and it is what a place
 * with a real body gets, because its content is taller than that. Only a place
 * whose whole sheet is shorter than the detent shrinks, so a toilet with three
 * lines does not float a card of empty glass.
 *
 * Measured against the SCROLL CONTENT, not the summary. Sizing this to the
 * summary alone collapses every card to a sliver and takes the mid size with
 * it — the summary is short for most places, and the facts card below it is
 * most of the sheet.
 *
 * `contentHeight` already includes the scroll view's bottom padding, which pays
 * for `bottomGap` itself; adding the gap again clips the card.
 *
 * `null` until the content has been measured, which tells the caller to keep
 * the default detent rather than snap to a guess.
 */
export function collapsedDetentHeight(
  input: FoldInput & { contentHeight: number | null },
): number | null {
  const { contentHeight, containerHeight, detentPercent, chromeAbove } = input;
  if (contentHeight === null || contentHeight <= 0) return null;
  return Math.min(
    Math.ceil(chromeAbove + contentHeight),
    Math.floor(detentHeight(containerHeight, detentPercent)),
  );
}
