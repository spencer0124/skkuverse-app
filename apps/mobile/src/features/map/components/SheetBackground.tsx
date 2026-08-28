/**
 * The campus sheet's background — a floating Liquid Glass card that becomes an
 * ordinary opaque sheet at the top detent, the way Apple Maps and Find My do.
 *
 * ## Why the opaque layer fades IN rather than the glass fading out
 *
 * Setting `opacity: 0` on a `GlassView`, or on any of its ancestors, stops it
 * rendering at all — it is not a fade, it is an off switch. So the `GlassView`
 * here sits at full opacity for the entire drag and a white layer dissolves in
 * over the top of it. The two states are the same view tree throughout.
 *
 * ## Why the height is computed instead of `bottom`
 *
 * Gorhom sizes the sheet body to the LARGEST detent and moves it with a
 * translate, so at the collapsed detent the body's bottom edge is most of a
 * screen BELOW the visible one. A bottom inset would land off-screen and take
 * the card's bottom corners with it. The visible bottom is `containerHeight`,
 * so the card's height has to be measured back from there.
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
 * Only the height and the radius are animated in this component. The card's
 * horizontal inset lives on the sheet body's own `style` prop, over in
 * CampusScreen, because it has to move three things at once: this background,
 * the handle, and the content. Insetting the background alone would leave any
 * content a few points from the card's edge, and — the part that actually
 * bites — would leave the strips either side of the card looking like map while
 * still belonging to the sheet's scroll view, so a drag there would move the
 * sheet rather than pan the map. Carrying it on the body also means content
 * padding is measured from the card's edge and rides in with it.
 */

import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import { SdsColors } from '@skkuverse/shared';
import { GLASS_AVAILABLE, glassFloatShadow } from '@/components/glass';
import { sheetChromeAt, SHEET_RADIUS_ATTACHED } from '../utils/sheetChrome';

/** Needed so the radius reaches the native `cornerConfiguration` every frame. */
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

interface SheetBackgroundProps {
  /** Supplied by gorhom: `StyleSheet.absoluteFillObject` plus any backgroundStyle. */
  style?: StyleProp<ViewStyle>;
  /** Supplied by gorhom. */
  pointerEvents?: ViewProps['pointerEvents'];
  animatedIndex: SharedValue<number>;
  animatedPosition: SharedValue<number>;
  /**
   * The sheet's container height. Measured by CampusScreen on its root view
   * rather than taken from the window, for the same reason the locate button's
   * anchor is: the sheet's percentages resolve against the container, which is
   * not the window once the tab bar is accounted for.
   */
  containerHeight: number;
  /** `snapPoints.length - 1`. */
  lastIndex: number;
}

/**
 * What gorhom's own background declares. Replacing the component drops these
 * unless they are re-declared, and a sheet that stops announcing itself to
 * VoiceOver is a regression no screenshot would catch.
 */
const a11y = {
  accessible: true,
  accessibilityRole: 'adjustable',
  accessibilityLabel: 'Bottom Sheet',
} as const;

export function SheetBackground({
  style,
  pointerEvents,
  animatedIndex,
  animatedPosition,
  containerHeight,
  lastIndex,
}: SheetBackgroundProps) {
  // Positioned from scratch rather than by spreading gorhom's absoluteFill:
  // `bottom: 0` and an explicit `height` are over-constrained, and which one
  // Yoga drops is not a thing to leave to chance. The body is already inset
  // horizontally by CampusScreen, so this only has to stop short at the bottom.
  const cardStyle = useAnimatedStyle(() => {
    const { inset, radius, bottomRadius } = sheetChromeAt(
      animatedIndex.get(),
      lastIndex,
    );
    return {
      height: Math.max(containerHeight - inset - animatedPosition.get(), 0),
      ...corners(radius, bottomRadius),
    };
  }, [containerHeight, lastIndex]);

  const glassStyle = useAnimatedStyle(() => {
    const { radius, bottomRadius } = sheetChromeAt(animatedIndex.get(), lastIndex);
    return corners(radius, bottomRadius);
  }, [lastIndex]);

  const fillStyle = useAnimatedStyle(() => {
    const { radius, bottomRadius, fillOpacity } = sheetChromeAt(
      animatedIndex.get(),
      lastIndex,
    );
    return { ...corners(radius, bottomRadius), opacity: fillOpacity };
  }, [lastIndex]);

  // One branch covers two cases that both want the sheet that shipped: every
  // platform without Liquid Glass, and the frames before the root view has been
  // measured (a card whose height is derived from a container height of 0 would
  // be a flash of nothing).
  if (!GLASS_AVAILABLE || containerHeight <= 0) {
    return <View {...a11y} pointerEvents={pointerEvents} style={[style, styles.attached]} />;
  }

  return (
    <Animated.View {...a11y} pointerEvents={pointerEvents} style={[styles.card, cardStyle]}>
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
  attached: {
    backgroundColor: SdsColors.background,
    borderTopLeftRadius: SHEET_RADIUS_ATTACHED,
    borderTopRightRadius: SHEET_RADIUS_ATTACHED,
  },
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
