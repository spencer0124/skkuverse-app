/**
 * The ordinary opaque sheet: a fill with rounded top corners, attached to the
 * screen's edges.
 *
 * Three unrelated cases all want exactly this, and share it rather than each
 * drawing their own the way the app used to:
 *
 *   - a `solid` sheet, at every detent;
 *   - a `glass` sheet on a platform without Liquid Glass — Android, iOS < 26;
 *   - a `glass` sheet stuck at `large`, which has no floating state to be in.
 *
 * ## Why the colour is static rather than adaptive
 *
 * The glass surfaces next door are pinned to `colorScheme="light"` because the
 * app forces a light interface style app-wide. Making this fill follow
 * `useAdaptive()` while the glass stays pinned would desynchronise the two the
 * moment dark mode is switched on, and a sheet that is half dark is worse than
 * one that is consistently light. Both move together or neither does.
 */

import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { SdsColors } from '@skkuverse/shared';
import { SHEET_RADIUS_ATTACHED } from './chrome';

/**
 * What gorhom's own background declares.
 *
 * Replacing `backgroundComponent` drops these unless they are re-declared, and
 * a sheet that stops announcing itself to VoiceOver is a regression no
 * screenshot would catch. Exported so every background in this folder states
 * them from one place — forgetting them is the whole reason the app has one
 * sheet component now.
 */
export const SHEET_BACKGROUND_A11Y = {
  accessible: true,
  accessibilityRole: 'adjustable',
  accessibilityLabel: 'Bottom Sheet',
} as const;

interface AttachedSheetBackgroundProps {
  /** Supplied by gorhom: `StyleSheet.absoluteFillObject` plus any backgroundStyle. */
  style?: StyleProp<ViewStyle>;
  /** Supplied by gorhom. */
  pointerEvents?: ViewProps['pointerEvents'];
}

export function AttachedSheetBackground({
  style,
  pointerEvents,
}: AttachedSheetBackgroundProps) {
  return (
    <View
      {...SHEET_BACKGROUND_A11Y}
      pointerEvents={pointerEvents}
      style={[style, styles.attached]}
    />
  );
}

const styles = StyleSheet.create({
  attached: {
    backgroundColor: SdsColors.background,
    borderTopLeftRadius: SHEET_RADIUS_ATTACHED,
    borderTopRightRadius: SHEET_RADIUS_ATTACHED,
  },
});
