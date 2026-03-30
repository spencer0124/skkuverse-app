/**
 * Radio — compound radio group (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <Radio value={selected} onChange={setSelected}>
 *     <Radio.Option value="a">Option A</Radio.Option>
 *     <Radio.Option value="b">Option B</Radio.Option>
 *   </Radio>
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { springConfig } from '../../foundation/easings';

// ── Context ──

interface RadioContextValue {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}

const RadioContext = createContext<RadioContextValue | null>(null);

// ── Radio Group ──

export interface RadioProps<Value = string> {
  value: Value;
  onChange: (value: Value) => void;
  children: ReactNode;
  /** @default false */
  disabled?: boolean;
  /** @default 0 */
  horizontalMargin?: number;
  style?: StyleProp<ViewStyle>;
}

function RadioGroup<Value = string>({
  value,
  onChange,
  children,
  disabled = false,
  horizontalMargin = 0,
  style,
}: RadioProps<Value>) {
  return (
    <RadioContext.Provider value={{ value, onChange: onChange as (v: unknown) => void, disabled }}>
      <View style={[styles.group, { paddingHorizontal: horizontalMargin }, style]}>
        {children}
      </View>
    </RadioContext.Provider>
  );
}

// ── Radio.Option ──

export interface RadioOptionProps<Value = string> {
  value: Value;
  children?: ReactNode;
  /** @default false */
  disabled?: boolean;
  onPress?: (value: Value) => void;
  style?: StyleProp<ViewStyle>;
}

const RADIO_SIZE = 22;
const INNER_SIZE = 10;

function RadioOption<Value = string>({
  value,
  children,
  disabled: optionDisabled = false,
  onPress,
  style,
}: RadioOptionProps<Value>) {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('Radio.Option must be used within <Radio>');

  const adaptive = useAdaptive();
  const isDisabled = ctx.disabled || optionDisabled;
  const isChecked = ctx.value === value;

  const innerScale = useSharedValue(isChecked ? 1 : 0);
  const bounceScale = useSharedValue(1);

  useEffect(() => {
    if (isChecked) {
      innerScale.value = withSpring(1, springConfig('quick'));
      bounceScale.value = withSequence(
        withSpring(0.85, springConfig('quick')),
        withSpring(1, springConfig('quick')),
      );
    } else {
      innerScale.value = withTiming(0, { duration: 150 });
    }
  }, [isChecked, innerScale, bounceScale]);

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    onPress?.(value);
    ctx.onChange(value);
  }, [isDisabled, onPress, ctx, value]);

  const outerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
  }));

  const innerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
    opacity: innerScale.value,
  }));

  const borderColor = isDisabled
    ? SdsColors.grey300
    : isChecked
      ? SdsColors.blue500
      : adaptive.grey400;

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.option, style]}
      accessibilityRole="radio"
      accessibilityState={{ checked: isChecked, disabled: isDisabled }}
    >
      <Animated.View style={outerAnimStyle}>
        <Svg width={RADIO_SIZE} height={RADIO_SIZE} viewBox={`0 0 ${RADIO_SIZE} ${RADIO_SIZE}`}>
          <Circle
            cx={RADIO_SIZE / 2}
            cy={RADIO_SIZE / 2}
            r={(RADIO_SIZE - 2) / 2}
            stroke={borderColor}
            strokeWidth={2}
            fill="none"
          />
        </Svg>
        <Animated.View style={[styles.innerDot, innerAnimStyle]}>
          <Svg width={INNER_SIZE} height={INNER_SIZE} viewBox={`0 0 ${INNER_SIZE} ${INNER_SIZE}`}>
            <Circle
              cx={INNER_SIZE / 2}
              cy={INNER_SIZE / 2}
              r={INNER_SIZE / 2}
              fill={isDisabled ? SdsColors.grey300 : SdsColors.blue500}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
      {children != null && <View style={styles.label}>{children}</View>}
    </Pressable>
  );
}

// ── Compound Export ──

export const Radio = Object.assign(RadioGroup, {
  Option: RadioOption,
});

const styles = StyleSheet.create({
  group: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  innerDot: {
    position: 'absolute',
    top: (RADIO_SIZE - INNER_SIZE) / 2,
    left: (RADIO_SIZE - INNER_SIZE) / 2,
  },
  label: {
    marginLeft: 12,
    flex: 1,
  },
});
