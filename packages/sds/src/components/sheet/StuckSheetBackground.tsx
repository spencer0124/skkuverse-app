/**
 * A floating Liquid Glass card for a sheet that never attaches.
 *
 * ## Why this is not `ExpandableSheetBackground`
 *
 * That one is for a sheet whose top detent is `large`, and every measurement in
 * it is a function of how far the sheet has been dragged: the card's height is
 * computed back from the container because gorhom sizes the sheet body to the
 * LARGEST detent, and the corners and the opaque fill are interpolated across
 * the detents. A sheet that keeps one shape has none of that to track. So this
 * is the same look with none of the machinery: no Reanimated, no measurement,
 * no crossfade.
 *
 * It covers a stuck sheet AND an expandable one whose detents stop below
 * `large` — the card is identical at every detent either way, so the drag needs
 * nothing drawn for it.
 *
 * ## Why a plain `absoluteFill` is enough here
 *
 * Its host passes gorhom `detached` with a `bottomInset`, and that changes what
 * the sheet body's box means. `BottomSheetHostingContainer` puts the inset on
 * the container itself (`bottom: bottomInset`) and flips both it and the
 * content wrapper to `overflow: 'visible'`, while `BottomSheetContent` drops
 * its over-drag padding. With no handle the body's box is then exactly the
 * visible card, and gorhom hands a background component
 * `StyleSheet.absoluteFillObject` — so filling it is the whole job. The visible
 * `overflow` is also what leaves the shadow and the glass's specular edge
 * whole; an attached sheet would clip both.
 *
 * The per-corner radii, and why the glass is never shaped by a rounded
 * `overflow: 'hidden'` parent, are explained in `ExpandableSheetBackground.tsx`.
 */

import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { GLASS_AVAILABLE, glassFloatShadow } from '../glass';
import { bottomCornerRadius, SHEET_RADIUS_FLOATING } from './chrome';
import { AttachedSheetBackground, SHEET_BACKGROUND_A11Y } from './AttachedSheetBackground';

interface StuckSheetBackgroundProps {
  /** Supplied by gorhom: `StyleSheet.absoluteFillObject` plus any backgroundStyle. */
  style?: StyleProp<ViewStyle>;
  /** Supplied by gorhom. */
  pointerEvents?: ViewProps['pointerEvents'];
  /** Gap between the card's bottom edge and the screen's, in points. */
  bottomGap: number;
}

export function StuckSheetBackground({
  style,
  pointerEvents,
  bottomGap,
}: StuckSheetBackgroundProps) {
  // Every platform without Liquid Glass keeps the attached sheet. Its host
  // leaves `detached` off in the same branch, so the two agree.
  if (!GLASS_AVAILABLE) {
    return <AttachedSheetBackground style={style} pointerEvents={pointerEvents} />;
  }

  /**
   * The bottom corners have to stay concentric with the display's own, or the
   * OS mask slices them off and the card reads as cut by the screen rather than
   * floating above it.
   *
   * `bottomCornerRadius` is the same rule the expandable card applies, so at a
   * gap that matches that card's the two land on the same answer. That is the
   * point rather than a coincidence — the two bottom edges sit on one line, and
   * a corner mismatch there would be the first thing anyone saw.
   */
  const corners = {
    borderTopLeftRadius: SHEET_RADIUS_FLOATING,
    borderTopRightRadius: SHEET_RADIUS_FLOATING,
    borderBottomLeftRadius: bottomCornerRadius(SHEET_RADIUS_FLOATING, bottomGap),
    borderBottomRightRadius: bottomCornerRadius(SHEET_RADIUS_FLOATING, bottomGap),
  };

  return (
    <View
      {...SHEET_BACKGROUND_A11Y}
      pointerEvents={pointerEvents}
      style={[style, styles.card, corners]}
    >
      <GlassView
        style={[StyleSheet.absoluteFill, corners]}
        glassEffectStyle="regular"
        // Explicit, not the 'auto' default: the app forces a light interface
        // style app-wide, so 'auto' would follow the system into dark and
        // diverge from every other surface on the screen.
        colorScheme="light"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // The frame paints nothing itself. It carries the radius anyway because
    // `boxShadow` is cast from the border metrics, so without one the shadow
    // would be a rectangle behind a rounded card and show at the corners.
    // `overflow` stays visible for the same reason — spelled out because
    // 'hidden' here would mask the shadow away and look like a token problem.
    overflow: 'visible',
    ...glassFloatShadow,
  },
});
