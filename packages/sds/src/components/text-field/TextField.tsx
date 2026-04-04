/**
 * TextField — input field with floating label, box/line variants.
 *
 * Compound: TextField.Clearable
 *
 * Usage:
 *   <TextField variant="box" label="이름" value={name} onChangeText={setName} />
 *   <TextField.Clearable variant="line" label="검색" value={q} onChangeText={setQ} />
 */
import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { XCircle } from 'lucide-react-native';
import { SdsColors } from '@skkuverse/shared';
import { useControlled } from '../../utils';
import { Txt } from '../txt';
import type { ReactNode } from 'react';

// ── Types ──

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'value' | 'defaultValue' | 'onChangeText'> {
  variant: 'box' | 'line';
  label?: string;
  /**
   * @default 'appear'
   * - appear: label shown only when value exists or focused
   * - sustain: label always shown
   */
  labelOption?: 'appear' | 'sustain';
  help?: ReactNode;
  /** @default false */
  hasError?: boolean;
  value?: string;
  defaultValue?: string;
  prefix?: string;
  suffix?: string;
  right?: ReactNode;
  /** @default false */
  disabled?: boolean;
  onChangeText?: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

// ── Main TextField ──

const TextFieldInner = forwardRef<TextInput, TextFieldProps & { showClear?: boolean; onClear?: () => void }>(
  function TextField(
    {
      variant,
      label,
      labelOption = 'appear',
      help,
      hasError = false,
      value: _value,
      defaultValue,
      prefix,
      suffix,
      right,
      disabled = false,
      onChangeText,
      containerStyle,
      showClear,
      onClear,
      placeholder,
      ...rest
    },
    ref,
  ) {
    const [value, setValue] = useControlled({
      controlledValue: _value,
      defaultValue: defaultValue ?? '',
    });
    const [focused, setFocused] = useState(false);

    const hasValue = value.length > 0;
    const isBox = variant === 'box';

    // ── Floating label animation ──
    // sustain: label always floated up; appear: only when focused/hasValue
    const shouldFloat = labelOption === 'sustain' || focused || hasValue;
    const labelY = useSharedValue(shouldFloat ? 0 : 18);
    const labelScale = useSharedValue(shouldFloat ? 0.75 : 1);

    useEffect(() => {
      labelY.value = withTiming(shouldFloat ? 0 : 18, { duration: 150 });
      labelScale.value = withTiming(shouldFloat ? 0.75 : 1, { duration: 150 });
    }, [shouldFloat, labelY, labelScale]);

    const labelAnimStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: labelY.value },
        { scale: labelScale.value },
      ],
    }));

    // ── Border color ──
    const borderColor = hasError
      ? SdsColors.red500
      : focused
        ? SdsColors.blue500
        : SdsColors.grey300;

    const handleChangeText = useCallback(
      (text: string) => {
        setValue(text);
        onChangeText?.(text);
      },
      [setValue, onChangeText],
    );

    const handleFocus = useCallback((e: any) => {
      setFocused(true);
      rest.onFocus?.(e);
    }, [rest.onFocus]);

    const handleBlur = useCallback((e: any) => {
      setFocused(false);
      rest.onBlur?.(e);
    }, [rest.onBlur]);

    // Label left position: 16 for box, 0 for line
    const labelLeft = isBox ? 16 : 0;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        <View
          style={[
            styles.container,
            isBox ? styles.boxContainer : styles.lineContainer,
            isBox
              ? { borderColor }
              : { borderBottomColor: borderColor },
            disabled && styles.disabled,
          ]}
        >
          {/* Floating label */}
          {label != null && (
            <Animated.View
              style={[
                styles.labelContainer,
                { left: labelLeft },
                labelAnimStyle,
              ]}
              pointerEvents="none"
            >
              <Txt
                typography="t7"
                color={hasError ? SdsColors.red500 : focused ? SdsColors.blue500 : SdsColors.grey500}
              >
                {label}
              </Txt>
            </Animated.View>
          )}

          <View style={styles.inputRow}>
            {prefix != null && (
              <Txt typography="t5" color={SdsColors.grey500} style={[styles.prefix, label != null && styles.inputWithLabel]}>
                {prefix}
              </Txt>
            )}
            <TextInput
              ref={ref}
              style={[
                styles.input,
                label != null && styles.inputWithLabel,
              ]}
              value={value}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={!shouldFloat ? placeholder : undefined}
              placeholderTextColor={SdsColors.grey400}
              editable={!disabled}
              allowFontScaling={false}
              {...rest}
            />
            {suffix != null && (
              <Txt typography="t5" color={SdsColors.grey500} style={[styles.suffix, label != null && styles.inputWithLabel]}>
                {suffix}
              </Txt>
            )}
            {showClear && hasValue && (
              <Pressable onPress={onClear} hitSlop={8} style={styles.clearButton}>
                <XCircle size={20} color={SdsColors.grey300} fill={SdsColors.grey300} />
              </Pressable>
            )}
            {right}
          </View>
        </View>

        {/* Help text */}
        {help != null && (
          <View style={styles.helpContainer}>
            {typeof help === 'string' ? (
              <Txt
                typography="t7"
                color={hasError ? SdsColors.red500 : SdsColors.grey500}
              >
                {help}
              </Txt>
            ) : (
              help
            )}
          </View>
        )}
      </View>
    );
  },
);

// ── TextField.Clearable ──

const ClearableTextField = forwardRef<TextInput, TextFieldProps & { onClear?: () => void }>(
  function ClearableTextField({ onClear, onChangeText, ...props }, ref) {
    const handleClear = useCallback(() => {
      onChangeText?.('');
      onClear?.();
    }, [onChangeText, onClear]);

    return (
      <TextFieldInner
        ref={ref}
        showClear
        onClear={handleClear}
        onChangeText={onChangeText}
        {...props}
      />
    );
  },
);

// ── Compound export ──

export const TextField = Object.assign(
  forwardRef<TextInput, TextFieldProps>(function TextField(props, ref) {
    return <TextFieldInner ref={ref} {...props} />;
  }),
  {
    Clearable: ClearableTextField,
  },
);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    justifyContent: 'center',
    minHeight: 56,
  },
  boxContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  lineContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 8,
  },
  disabled: {
    opacity: 0.38,
  },
  labelContainer: {
    position: 'absolute',
    top: 8,
    transformOrigin: 'left top',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: SdsColors.grey900,
    padding: 0,
  },
  inputWithLabel: {
    marginTop: 14,
  },
  prefix: {
    marginRight: 4,
  },
  suffix: {
    marginLeft: 4,
  },
  clearButton: {
    marginLeft: 8,
  },
  helpContainer: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
});
