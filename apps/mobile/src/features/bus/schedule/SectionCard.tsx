/**
 * Section card — white background wrapper for the sectioned layout.
 *
 * The schedule screen uses grey50 background with white section cards.
 */

import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SdsColors } from '@skkuverse/shared';

interface SectionCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionCard({ children, style }: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = {
  card: {
    backgroundColor: SdsColors.background,
  } as ViewStyle,
};
