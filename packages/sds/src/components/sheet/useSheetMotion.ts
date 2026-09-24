/**
 * The sheet's live position and detent, as gorhom itself moves the body.
 *
 * Anything drawn frame by frame against the sheet's edges reads these, never
 * the `animatedPosition` / `animatedIndex` a caller hands to `Sheet`. Those are
 * copies: gorhom fills them from its own values in a `useAnimatedReaction`,
 * and Reanimated does not order a style that reads the copy after the reaction
 * that writes it. On roughly half the frames of a drag the style runs first and
 * sees last frame's position, while the body's `translateY` already has this
 * frame's. The card's top edge rides the translate and its bottom edge is a
 * height computed from the position, so the bottom edge overshoots by however
 * far the finger moved in one frame and shakes. Measured on the campus sheet:
 * 46% of drag frames lagged, by up to 153pt on a flick.
 *
 * Only callable below the sheet — a `backgroundComponent`, or the sheet's
 * children — where gorhom's internal provider resolves. Numerically equal to
 * the copies because `Sheet` passes gorhom no `topInset`.
 */

import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import type { SharedValue } from 'react-native-reanimated';

export interface SheetMotion {
  /** The body's top edge, px from the top of the sheet's container. */
  animatedPosition: SharedValue<number>;
  /** The detent, fractional mid-drag. */
  animatedIndex: SharedValue<number>;
}

export function useSheetMotion(): SheetMotion {
  const { animatedPosition, animatedIndex } = useBottomSheetInternal();
  return { animatedPosition, animatedIndex };
}
