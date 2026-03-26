/**
 * IconButton — icon-only button with fill/clear/border variants.
 *
 * Press animation: scale 0.9x spring (same pattern as Button).
 * TDS default variant is 'clear'.
 */
import React, { forwardRef, useCallback, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAdaptive } from '../../core';
import { springConfig } from '../../foundation/easings';

export interface IconButtonProps {
  icon: ReactNode;
  /** @default 24 */
  iconSize?: number;
  /** @default 'clear' */
  variant?: 'fill' | 'clear' | 'border';
  color?: string;
  /** @default adaptive.greyOpacity100 */
  bgColor?: string;
  disabled?: boolean;
  /** Accessibility label */
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

export const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    icon,
    iconSize = 24,
    variant = 'clear',
    color,
    bgColor,
    disabled = false,
    label,
    onPress,
    style,
  },
  ref,
) {
  const adaptive = useAdaptive();
  const scale = useSharedValue(1);
  const containerSize = iconSize + iconSize * 0.5;
  const borderRadius = containerSize / 2;
  const defaultBgColor = adaptive.grey100;

  const handlePressIn = useCallback(() => {
    if (!disabled) {
      scale.value = withSpring(0.9, springConfig('rapid'));
    }
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig('rapid'));
    }
  }, [disabled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerStyles: ViewStyle[] = [
    styles.container,
    {
      width: containerSize,
      height: containerSize,
      borderRadius,
    },
  ];

  if (variant === 'fill') {
    containerStyles.push({ backgroundColor: bgColor ?? defaultBgColor });
  } else if (variant === 'border') {
    containerStyles.push({
      borderWidth: 1,
      borderColor: bgColor ?? adaptive.grey200,
      backgroundColor: 'transparent',
    });
  }
  // 'clear' — no background

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      ref={ref}
      style={style}
    >
      <Animated.View
        style={[
          containerStyles,
          { opacity: disabled ? 0.38 : 1 },
          animatedStyle,
        ]}
      >
        {icon}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
