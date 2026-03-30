/**
 * FixedBottomCTA — bottom CTA with keyboard avoiding behavior.
 *
 * Usage:
 *   <FixedBottomCTA>
 *     <Button display="block">Submit</Button>
 *   </FixedBottomCTA>
 */
import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsColors } from '@skkuverse/shared';

export interface FixedBottomCTAProps {
  children: ReactNode;
  /** @default true */
  enableKeyboardAvoiding?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function FixedBottomCTA({
  children,
  enableKeyboardAvoiding = true,
  style,
}: FixedBottomCTAProps) {
  const insets = useSafeAreaInsets();

  const content = (
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

  if (!enableKeyboardAvoiding) return content;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.wrapper}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
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

export { FixedBottomCTA };
