/**
 * SearchField — search input with icon and clear button.
 *
 * Usage:
 *   <SearchField placeholder="검색어를 입력하세요" value={text} onChangeText={setText} />
 */
import React, { forwardRef, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { SdsColors } from '@skkuuniverse/shared';
import { useControlled } from '../../utils';
import { Txt } from '../txt';

// ── Search icon ──

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={SdsColors.grey400} strokeWidth={2} />
      <Line x1={16.5} y1={16.5} x2={21} y2={21} stroke={SdsColors.grey400} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Clear icon ──

function ClearIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={SdsColors.grey300} />
      <Path d="M8 8L16 16M16 8L8 16" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  /** @default false */
  hasClearButton?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  {
    value: _value,
    defaultValue,
    onChangeText,
    hasClearButton = false,
    style,
    placeholder,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControlled({
    controlledValue: _value,
    defaultValue: defaultValue ?? '',
  });

  const handleChangeText = useCallback(
    (text: string) => {
      setValue(text);
      onChangeText?.(text);
    },
    [setValue, onChangeText],
  );

  const handleClear = useCallback(() => {
    setValue('');
    onChangeText?.('');
  }, [setValue, onChangeText]);

  const showClear = hasClearButton && value.length > 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconLeft}>
        <SearchIcon />
      </View>
      <TextInput
        ref={ref}
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={SdsColors.grey400}
        returnKeyType="search"
        allowFontScaling={false}
        {...rest}
      />
      {showClear && (
        <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8}>
          <ClearIcon />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SdsColors.grey100,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  iconLeft: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: SdsColors.grey900,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
});
