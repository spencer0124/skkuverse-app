/**
 * The background for a sheet that floats low down and ATTACHES at `large` — a
 * Liquid Glass card that becomes an ordinary opaque sheet at the top detent,
 * the way Apple Maps and Find My do.
 *
 * This is the only sheet shape that has to be drawn frame by frame. Every other
 * one keeps a single shape and is handed to gorhom's `detached` mode instead;
 * see `StuckSheetBackground`.
 *
 * ## Why the opaque layer fades IN rather than the glass fading out
 *
 * Setting `opacity: 0` on a `GlassView`, or on any of its ancestors, stops it
 * rendering at all — it is not a fade, it is an off switch. So the `GlassView`
 * here sits at full opacity for the entire drag and a white layer dissolves in
 * over the top of it. The two states are the same view tree throughout, and the
 * frame carrying the card's geometry and shadow must never take an animated
 * opacity, because it would take the glass with it.
 *
 * ## Why the height is computed instead of `bottom`
 *
 * Gorhom sizes the sheet body to the LARGEST detent and moves it with a
 * translate, so at the collapsed detent the body's bottom edge is most of a
 * screen BELOW the visible one. A bottom inset would land off-screen and take
 * the card's bottom corners with it. The visible bottom is the container's
 * height, so the card's height has to be measured back from there.
 *
 * ## Why the container height is read from gorhom rather than passed in
 *
 * `backgroundComponent` is rendered inside `BottomSheetInternalProvider`, so
 * `useBottomSheetInternal()` resolves here and `animatedLayoutState` already
 * carries the height gorhom itself resolves percentage detents against. Taking
 * it as a prop would mean every host measured its own root view and hoped the
 * two agreed. One `useAnimatedReaction` mirrors "has it been measured yet" back
 * to JS, which is all the render-time branch below needs.
 *
 * ## Why the glass rounds itself instead of being clipped
 *
 * `expo-glass-effect` exposes `borderRadius` as a NATIVE prop —
 * `GlassEffectModule.swift` maps it onto `glassEffectView.cornerConfiguration`,
 * UIKit's own corner configuration. Wrapping the glass in a rounded
 * `overflow: 'hidden'` parent would work, but it would draw the effect square
 * and then cut it, so the bright specular line along the edge stops tracing the
 * corner and gets sliced off at four points. Letting the native prop shape it
 * keeps Apple's continuous corner with the highlight following it, and means no
 * node here needs `overflow: 'hidden'` — which is what leaves the shadow whole.
 *
 * ## Why the side inset is NOT here
 *
 * Only the height and the radii are animated in this component. The card's
 * horizontal inset lives on the sheet body's own `style` prop, over in
 * `Sheet.tsx`, because it has to move three things at once: this background,
 * the handle, and the content. Insetting the background alone would leave any
 * content a few points from the card's edge and — the part that actually bites
 * — would leave the strips either side of the card looking like map while still
 * belonging to the sheet's scroll view, so a drag there would move the sheet
 * rather than pan the map.
 */

import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import { SdsColors } from '@skkuverse/shared';
import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import { GLASS_AVAILABLE, glassFloatShadow } from '../glass';
import { bottomCornerRadius, sheetChromeAt, SHEET_FLOAT_INSET } from './chrome';
import { AttachedSheetBackground, SHEET_BACKGROUND_A11Y } from './AttachedSheetBackground';

/** Needed so the radii reach the native `cornerConfiguration` every frame. */
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

/**
 * Per-corner radii. Spelled out rather than using `borderRadius`, because the
 * bottom two are larger than the top two — they have to stay concentric with
 * the display's own corner. `expo-glass-effect` registers every one of these as
 * a native prop, so the glass takes the same shape as the fill above it.
 */
function corners(top: number, bottom: number) {
  'worklet';
  return {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };
}

interface ExpandableSheetBackgroundProps {
  /** Supplied by gorhom: `StyleSheet.absoluteFillObject` plus any backgroundStyle. */
  style?: StyleProp<ViewStyle>;
  /** Supplied by gorhom. */
  pointerEvents?: ViewProps['pointerEvents'];
  animatedIndex: SharedValue<number>;
  animatedPosition: SharedValue<number>;
  /** `snapPoints.length - 1`. */
  lastIndex: number;
  /**
   * The card's bottom gap while it floats, closing to 0 as it attaches.
   *
   * Not `SHEET_FLOAT_INSET` for every sheet, because the gap is measured from
   * the card's own CONTAINER and those differ. An inline sheet's container is
   * the screen's root view, whose bottom edge already sits above the tab bar,
   * so 8pt lands where it looks. A modal is portalled out and its container is
   * the whole window, so reaching the same line on screen takes a larger
   * number. Both cards have to end up on one line or the mismatch is the first
   * thing anyone sees.
   */
  floatBottomGap?: number;
}

export function ExpandableSheetBackground({
  style,
  pointerEvents,
  animatedIndex,
  animatedPosition,
  lastIndex,
  floatBottomGap = SHEET_FLOAT_INSET,
}: ExpandableSheetBackgroundProps) {
  const { animatedLayoutState } = useBottomSheetInternal();
  const [measured, setMeasured] = useState(false);

  // Gorhom reports a container height of 0 for the frames before its first
  // layout, and a card whose height is derived from that would be a flash of
  // nothing. This flips once and never flips back, so the cost is one JS hop
  // on mount rather than anything per frame.
  useAnimatedReaction(
    () => animatedLayoutState.get().containerHeight > 0,
    (isMeasured, wasMeasured) => {
      if (isMeasured !== wasMeasured) {
        runOnJS(setMeasured)(isMeasured);
      }
    },
    [],
  );

  // Positioned from scratch rather than by spreading gorhom's absoluteFill:
  // `bottom: 0` and an explicit `height` are over-constrained, and which one
  // Yoga drops is not a thing to leave to chance. The body is already inset
  // horizontally by `Sheet`, so this only has to stop short at the bottom.
  const cardStyle = useAnimatedStyle(() => {
    const { progress, radius } = sheetChromeAt(animatedIndex.get(), lastIndex);
    const bottomGap = floatBottomGap * (1 - progress);
    const containerHeight = animatedLayoutState.get().containerHeight;
    return {
      height: Math.max(containerHeight - bottomGap - animatedPosition.get(), 0),
      ...corners(radius, bottomCornerRadius(radius, bottomGap)),
    };
  }, [lastIndex, floatBottomGap]);

  const glassStyle = useAnimatedStyle(() => {
    const { progress, radius } = sheetChromeAt(animatedIndex.get(), lastIndex);
    return corners(radius, bottomCornerRadius(radius, floatBottomGap * (1 - progress)));
  }, [lastIndex, floatBottomGap]);

  const fillStyle = useAnimatedStyle(() => {
    const { progress, radius, fillOpacity } = sheetChromeAt(
      animatedIndex.get(),
      lastIndex,
    );
    return {
      ...corners(radius, bottomCornerRadius(radius, floatBottomGap * (1 - progress))),
      opacity: fillOpacity,
    };
  }, [lastIndex, floatBottomGap]);

  // One branch covers two cases that both want the plain attached sheet: every
  // platform without Liquid Glass, and the frames before the container has been
  // measured.
  if (!GLASS_AVAILABLE || !measured) {
    return <AttachedSheetBackground style={style} pointerEvents={pointerEvents} />;
  }

  return (
    <Animated.View
      {...SHEET_BACKGROUND_A11Y}
      pointerEvents={pointerEvents}
      style={[styles.card, cardStyle]}
    >
      <AnimatedGlassView
        style={[StyleSheet.absoluteFill, glassStyle]}
        glassEffectStyle="regular"
        // Explicit, not the 'auto' default: the app forces a light interface
        // style app-wide, so 'auto' would follow the system into dark and
        // diverge from every other surface on the screen.
        colorScheme="light"
      />
      <Animated.View style={[styles.fill, fillStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // The frame paints nothing itself. It carries a radius anyway because
    // `boxShadow` is cast from the border metrics, so without one the shadow
    // would be a rectangle behind a rounded card and show at the corners.
    // `overflow` stays visible for the same reason — spelled out because
    // 'hidden' here would mask the shadow away and look like a token problem.
    overflow: 'visible',
    ...glassFloatShadow,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SdsColors.background,
    // Matches the glass, which UIKit draws with a continuous corner.
    borderCurve: 'continuous',
  },
});
