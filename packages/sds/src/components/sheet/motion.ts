import { timingConfig } from '../../foundation/easings';

/**
 * The hand-off between the campus sheet and a detail modal, as two timings.
 *
 * Two sheets never stack (`sheetHandoff.ts`): the campus sheet goes down, and
 * the modal rises only once it has landed. Under gorhom's default spring the
 * pair read as a pause — a list row tapped, the list sinking slowly, then the
 * place climbing up. The order stays; the two moves are just short, so the
 * whole hand-off is over in about 0.4 s.
 *
 * Both are timings rather than springs because a spring's length is whatever
 * its physics settles to, and a hand-off gated on "the first one has landed"
 * wants a length it can state.
 */

/** The campus sheet getting out of the way: short, easing out. */
export const SHEET_HANDOFF_CLOSE = timingConfig('out', 150);

/** A detail modal arriving: expo, so it moves most in its first frames. */
export const SHEET_HANDOFF_RISE = timingConfig('expo', 250);
