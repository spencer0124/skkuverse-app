/**
 * Checkbox — Line and Circle variants (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <Checkbox.Line checked={value} onCheckedChange={setValue}>Label</Checkbox.Line>
 *   <Checkbox.Circle checked={value} onCheckedChange={setValue} />
 */
import React, { type ReactNode, useCallback, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { SdsColors } from '@skkuverse/shared';
import { useControlled } from '../../utils';
import { springConfig } from '../../foundation/easings';

// ── Types ──

export interface CheckboxProps {
  children?: ReactNode;
  checked?: boolean;
  /** @default 24 */
  size?: number;
  disabled?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}

// ── Wiggle hook ──

function useWiggle() {
  const x = useSharedValue(0);

  const startWiggle = useCallback(() => {
    x.value = withSequence(
      withTiming(-3, { duration: 50 }),
      withTiming(3, { duration: 50 }),
      withTiming(-2, { duration: 50 }),
      withTiming(2, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [x]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return { startWiggle, style: animStyle };
}

// ── Checkmark SVG ──

function Checkmark({ size, color }: { size: number; color: string }) {
  const scale = size / 24;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={`M${6 * scale} ${12 * scale}L${10 * scale} ${16 * scale}L${18 * scale} ${8 * scale}`}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ── Checkbox.Line ──

function CheckboxLine({
  checked: _checked,
  defaultChecked,
  disabled = false,
  size = 24,
  style,
  children,
  onCheckedChange,
  onPress,
  ...pressableProps
}: CheckboxProps) {
  const [checked, setChecked] = useControlled({
    controlledValue: _checked,
    defaultValue: defaultChecked ?? false,
  });

  const { startWiggle, style: wiggleStyle } = useWiggle();
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    bgOpacity.value = withTiming(checked ? 1 : 0, { duration: 150 });
    scale.value = withSequence(
      withSpring(0.85, springConfig('quick')),
      withSpring(1, springConfig('quick')),
    );
  }, [checked, bgOpacity, scale]);

  const handlePress = useCallback(
    (e: any) => {
      if (disabled) {
        startWiggle();
        return;
      }
      onPress?.(e);
      onCheckedChange?.(!checked);
      setChecked(!checked);
    },
    [disabled, onPress, onCheckedChange, checked, setChecked, startWiggle],
  );

  const checkboxAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgAnimStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.lineContainer, style]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      {...pressableProps}
    >
      <Animated.View style={[disabled ? undefined : wiggleStyle]}>
        <Animated.View style={[{ width: size, height: size }, checkboxAnimStyle]}>
          {/* Unchecked background */}
          <View
            style={[
              styles.lineCheckbox,
              {
                width: size,
                height: size,
                borderRadius: size * 0.25,
                borderWidth: 2,
                borderColor: disabled ? SdsColors.grey300 : SdsColors.grey400,
                backgroundColor: 'transparent',
              },
            ]}
          />
          {/* Checked background */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: size * 0.25,
                backgroundColor: disabled ? SdsColors.grey300 : SdsColors.blue500,
              },
              bgAnimStyle,
            ]}
          />
          {/* Checkmark */}
          {checked && (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Checkmark size={size} color={SdsColors.background} />
            </View>
          )}
        </Animated.View>
      </Animated.View>
      {children != null && <View style={styles.lineLabel}>{children}</View>}
    </Pressable>
  );
}

// ── Checkbox.Circle ──

function CheckboxCircle({
  checked: _checked,
  defaultChecked,
  disabled = false,
  size = 24,
  style,
  children,
  onCheckedChange,
  onPress,
  ...pressableProps
}: CheckboxProps) {
  const [checked, setChecked] = useControlled({
    controlledValue: _checked,
    defaultValue: defaultChecked ?? false,
  });

  const { startWiggle, style: wiggleStyle } = useWiggle();
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    bgOpacity.value = withTiming(checked ? 1 : 0, { duration: 150 });
    scale.value = withSequence(
      withSpring(0.85, springConfig('quick')),
      withSpring(1, springConfig('quick')),
    );
  }, [checked, bgOpacity, scale]);

  const handlePress = useCallback(
    (e: any) => {
      if (disabled) {
        startWiggle();
        return;
      }
      onPress?.(e);
      onCheckedChange?.(!checked);
      setChecked(!checked);
    },
    [disabled, onPress, onCheckedChange, checked, setChecked, startWiggle],
  );

  const checkboxAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgAnimStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.lineContainer, style]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      {...pressableProps}
    >
      <Animated.View style={[disabled ? undefined : wiggleStyle]}>
        <Animated.View style={[{ width: size, height: size }, checkboxAnimStyle]}>
          {/* Unchecked circle */}
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: disabled ? SdsColors.grey300 : SdsColors.grey400,
              backgroundColor: 'transparent',
            }}
          />
          {/* Checked circle */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: size / 2,
                backgroundColor: disabled ? SdsColors.grey300 : SdsColors.blue500,
              },
              bgAnimStyle,
            ]}
          />
          {/* Checkmark */}
          {checked && (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Checkmark size={size} color={SdsColors.background} />
            </View>
          )}
        </Animated.View>
      </Animated.View>
      {children != null && <View style={styles.lineLabel}>{children}</View>}
    </Pressable>
  );
}

// ── Compound export ──

export const Checkbox = {
  Line: CheckboxLine,
  Circle: CheckboxCircle,
};

const styles = StyleSheet.create({
  lineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineCheckbox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineLabel: {
    marginLeft: 12,
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
