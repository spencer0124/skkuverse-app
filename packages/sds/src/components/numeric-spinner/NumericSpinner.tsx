/**
 * NumericSpinner — [-] number [+] input (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <NumericSpinner size="large" number={qty} onNumberChange={setQty} minNumber={1} maxNumber={10} />
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { useControlled } from '../../utils';
import { Txt } from '../txt';

// ── Size config ──

type SpinnerSize = 'tiny' | 'small' | 'medium' | 'large';

const sizeConfig: Record<SpinnerSize, { button: number; iconSize: number; fontSize: 't5' | 't6' | 't7' }> = {
  tiny: { button: 28, iconSize: 14, fontSize: 't7' },
  small: { button: 32, iconSize: 16, fontSize: 't6' },
  medium: { button: 36, iconSize: 18, fontSize: 't6' },
  large: { button: 40, iconSize: 20, fontSize: 't5' },
};

// ── Icons ──

function MinusIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Props ──

export interface NumericSpinnerProps {
  number?: number;
  defaultNumber?: number;
  onNumberChange?: (value: number) => void;
  /** @default 0 */
  minNumber?: number;
  /** @default 999 */
  maxNumber?: number;
  size: SpinnerSize;
  /** @default false */
  disable?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function NumericSpinner({
  number: controlledNumber,
  defaultNumber,
  onNumberChange,
  minNumber = 0,
  maxNumber = 999,
  size,
  disable = false,
  style,
}: NumericSpinnerProps) {
  const adaptive = useAdaptive();
  const config = sizeConfig[size];

  const [value, setValue] = useControlled({
    controlledValue: controlledNumber,
    defaultValue: defaultNumber ?? minNumber,
  });

  const isMinReached = value <= minNumber;
  const isMaxReached = value >= maxNumber;

  const handleDecrement = useCallback(() => {
    if (disable || isMinReached) return;
    const next = Math.max(minNumber, value - 1);
    onNumberChange?.(next);
    setValue(next);
  }, [disable, isMinReached, minNumber, value, onNumberChange, setValue]);

  const handleIncrement = useCallback(() => {
    if (disable || isMaxReached) return;
    const next = Math.min(maxNumber, value + 1);
    onNumberChange?.(next);
    setValue(next);
  }, [disable, isMaxReached, maxNumber, value, onNumberChange, setValue]);

  const buttonDisabledColor = SdsColors.grey300;
  const buttonActiveColor = adaptive.grey700;

  return (
    <View style={[styles.container, { opacity: disable ? 0.4 : 1 }, style]}>
      {/* Minus */}
      <Pressable
        onPress={handleDecrement}
        style={[
          styles.button,
          {
            width: config.button,
            height: config.button,
            borderRadius: config.button / 2,
            backgroundColor: adaptive.grey100,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        accessibilityState={{ disabled: disable || isMinReached }}
      >
        <MinusIcon
          size={config.iconSize}
          color={isMinReached ? buttonDisabledColor : buttonActiveColor}
        />
      </Pressable>

      {/* Number */}
      <View style={styles.numberContainer}>
        <Txt
          typography={config.fontSize}
          fontWeight="semiBold"
          color={adaptive.grey900}
          textAlign="center"
        >
          {value}
        </Txt>
      </View>

      {/* Plus */}
      <Pressable
        onPress={handleIncrement}
        style={[
          styles.button,
          {
            width: config.button,
            height: config.button,
            borderRadius: config.button / 2,
            backgroundColor: adaptive.grey100,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Increase"
        accessibilityState={{ disabled: disable || isMaxReached }}
      >
        <PlusIcon
          size={config.iconSize}
          color={isMaxReached ? buttonDisabledColor : buttonActiveColor}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberContainer: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { NumericSpinner };
