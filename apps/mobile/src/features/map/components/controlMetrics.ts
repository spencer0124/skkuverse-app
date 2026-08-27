/**
 * Shared geometry for the floating control row over the map.
 *
 * The row holds a stretch-width control (the campus toggle) beside one or two
 * fixed circular buttons, and they only read as one control set if every piece
 * is exactly the same height. Each of them used to derive its own height — the
 * search bar from its padding plus line height, the buttons from a local
 * `SIZE`, the segmented control from whatever UIKit chose — which agreed by
 * luck rather than by construction. One constant, so they cannot drift apart.
 */
export const MAP_CONTROL_HEIGHT = 40;


/** Breathing room between stacked floating controls over the map. */
export const MAP_CONTROL_GAP = 12;
