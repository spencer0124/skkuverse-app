/**
 * Keeps a mini-app page where it was through an iOS back swipe that is
 * started and then let go.
 *
 * The screen under the mini-app shell, `(tabs)`, has no header. The moment an
 * interactive pop begins, react-native-screens applies that screen's config and
 * hides the navigation bar, and while the bar is hidden it reports a header
 * height of 0 (`calculateHeaderHeightIsModal`). Under an opaque header that
 * moved the WebView's frame mid-gesture, and back again on cancel, and the page
 * came back scrolled to the top. The shell now lays the WebView out itself
 * below a translucent header, so the frame no longer follows the bar; these
 * are the two guards around that:
 *
 *   - the header height the shell lays out with holds still while a
 *     transition is running, and never drops to 0 (a hidden bar, not a real
 *     header of height 0);
 *   - if the page still ends up near the top after a cancelled swipe, the
 *     shell scrolls it back.
 *
 * Pure and free of React Native imports so `node --test` can pin it.
 */

/**
 * The header height to lay out with, given the last one used and the one just
 * reported. `transitioning` is true between a `transitionStart` and its
 * `transitionEnd` or `gestureCancel`.
 */
export function stableHeaderHeight(prev: number, reported: number, transitioning: boolean): number {
  const valid = Number.isFinite(reported) && reported > 0;
  if (prev > 0 && (transitioning || !valid)) return prev;
  return valid ? reported : prev;
}

/** Below this the page was at (or near) the top anyway: nothing to restore. */
export const RESTORE_MIN_OFFSET = 50;

/**
 * The scroll offset to put a page back to after a cancelled swipe, or null to
 * leave it. `before` is the offset when the swipe began, `after` the offset
 * once it was let go. Only a real collapse counts, less than half of where it
 * was, so a page that scrolled on its own or a little rubber-band is left be.
 */
export function scrollToRestore(before: number, after: number): number | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before < RESTORE_MIN_OFFSET) return null;
  if (after >= before / 2) return null;
  return Math.round(before);
}
