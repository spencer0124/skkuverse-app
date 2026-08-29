/**
 * A floating Liquid Glass card for a sheet that never changes size.
 *
 * ## Why this is not `SheetBackground`
 *
 * That one is the campus sheet's background, and every measurement in it is a
 * function of how far the sheet has been dragged: the card's height is computed
 * back from the container because gorhom sizes the sheet body to the LARGEST
 * detent, and the corners and the opaque fill are interpolated across the
 * detents. A sheet with one snap point and both pan gestures off has none of
 * that to track — `sheetChromeAt` even degrades to the attached sheet at
 * `lastIndex <= 0`, which is exactly the case here. So this is the same look
 * with none of the machinery: no Reanimated, no measurement, no crossfade.
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
 * `overflow: 'hidden'` parent, are explained in `SheetBackground.tsx`.
 */

import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { SdsColors } from '@skkuverse/shared';
import { GLASS_AVAILABLE, glassFloatShadow } from '@/components/glass';
import {
  DISPLAY_CORNER_RADIUS,
  SHEET_RADIUS_ATTACHED,
  SHEET_RADIUS_FLOATING,
} from '../utils/sheetChrome';

interface GlassCardBackgroundProps {
  /** Supplied by gorhom: `StyleSheet.absoluteFillObject` plus any backgroundStyle. */
  style?: StyleProp<ViewStyle>;
  /** Supplied by gorhom. */
  pointerEvents?: ViewProps['pointerEvents'];
  /** Gap between the card's bottom edge and the screen's, in points. */
  bottomGap: number;
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

export function GlassCardBackground({
  style,
  pointerEvents,
  bottomGap,
}: GlassCardBackgroundProps) {
  // Every platform without Liquid Glass keeps the attached sheet that shipped.
  // Its host leaves `detached` off in the same branch, so the two agree.
  if (!GLASS_AVAILABLE) {
    return <View {...a11y} pointerEvents={pointerEvents} style={[style, styles.attached]} />;
  }

  /**
   * The bottom corners have to stay concentric with the display's own, or the
   * OS mask slices them off and the card reads as cut by the screen rather than
   * floating above it: a rect inset by `i` stays inside a display of radius `R`
   * only while its corners are at least `R - i`.
   *
   * The same rule `sheetChromeAt` applies to the campus card, so at a gap that
   * matches that card's the two land on the same answer. That is the point
   * rather than a coincidence — the two bottom edges sit on one line, and a
   * corner mismatch there would be the first thing anyone saw.
   */
  const bottomRadius = Math.max(SHEET_RADIUS_FLOATING, DISPLAY_CORNER_RADIUS - bottomGap);
  const corners = {
    borderTopLeftRadius: SHEET_RADIUS_FLOATING,
    borderTopRightRadius: SHEET_RADIUS_FLOATING,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  };

  return (
    <View {...a11y} pointerEvents={pointerEvents} style={[style, styles.card, corners]}>
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
  attached: {
    backgroundColor: SdsColors.background,
    borderTopLeftRadius: SHEET_RADIUS_ATTACHED,
    borderTopRightRadius: SHEET_RADIUS_ATTACHED,
  },
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
