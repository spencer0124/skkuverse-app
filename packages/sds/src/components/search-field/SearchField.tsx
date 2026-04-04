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
import { Search, XCircle } from 'lucide-react-native';
import { SdsColors } from '@skkuverse/shared';
import { useControlled } from '../../utils';
import { Txt } from '../txt';

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
        <Search size={20} color={SdsColors.grey400} />
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
          <XCircle size={20} color={SdsColors.grey300} fill={SdsColors.grey300} />
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
