/**
 * TextButton — text-only button with arrow/underline/clear variants.
 *
 * Reimplemented from TDS TextButton API.
 */
import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import type { TypographyKeys } from '../../foundation/typography';

export interface TextButtonProps {
  children: ReactNode;
  /** Required — sets the text size */
  typography: TypographyKeys;
  /** @default 'clear' */
  variant?: 'arrow' | 'underline' | 'clear';
  /** @default 'regular' */
  fontWeight?: 'regular' | 'medium' | 'semiBold' | 'bold';
  /** @default adaptive.grey900 */
  color?: string;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

export function TextButton({
  children,
  typography,
  variant = 'clear',
  fontWeight = 'regular',
  color,
  disabled = false,
  onPress,
  style,
}: TextButtonProps) {
  const adaptive = useAdaptive();
  const resolvedColor = color ?? adaptive.grey900;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.container, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Txt
        typography={typography}
        fontWeight={fontWeight}
        color={resolvedColor}
        style={[
          { opacity: disabled ? 0.38 : 1 },
          variant === 'underline' && styles.underline,
        ]}
      >
        {children}
        {variant === 'arrow' ? ' ›' : ''}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  underline: {
    textDecorationLine: 'underline',
  },
});
