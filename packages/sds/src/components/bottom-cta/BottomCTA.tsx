/**
 * BottomCTA — bottom-fixed call-to-action container.
 *
 * Usage:
 *   <BottomCTA>
 *     <Button display="block">Continue</Button>
 *   </BottomCTA>
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsColors } from '@skkuverse/shared';

export interface BottomCTAProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function BottomCTA({ children, style }: BottomCTAProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 16) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SdsColors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
});

export { BottomCTA };
