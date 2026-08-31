/**
 * A sheet's pinned header row: a title on the left, a close control on the
 * right.
 *
 * A SIBLING of the scrollable, never its first row. Inside it, the X would ride
 * up and out of reach the moment the content grew past the sheet, and closing
 * has to stay one tap away at every scroll position. That also makes the title
 * a pinned sheet title rather than a heading that scrolls away with its own
 * content, which is how the system sheets behave.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import { SheetCloseButton } from './SheetCloseButton';

export interface SheetHeaderProps {
  title?: string;
  /**
   * Accessibility label for the close control. Omit it to leave the control
   * out — which is the right call only for an inline sheet, since a modal that
   * can only be dragged away looks stuck to anyone who does not know the
   * gesture.
   */
  closeLabel?: string;
  /** Replaces the close control, for a sheet that needs a different action. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SheetHeader({ title, closeLabel, right, style }: SheetHeaderProps) {
  const adaptive = useAdaptive();
  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleSlot}>
        {title != null && (
          <Txt typography="t4" fontWeight="bold" color={adaptive.grey900} numberOfLines={1}>
            {title}
          </Txt>
        )}
      </View>
      {right ?? (closeLabel != null ? <SheetCloseButton label={closeLabel} /> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  // Lets a long title truncate instead of shoving the close control off the
  // card's edge.
  titleSlot: {
    flexShrink: 1,
  },
});
