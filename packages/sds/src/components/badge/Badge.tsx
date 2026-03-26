/**
 * Badge — small label component (beautified from TDS).
 *
 * Usage:
 *   <Badge size="small" color={colors.blue500} backgroundColor={colors.blue50}>New</Badge>
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import type { FontWeightKeys, TypographyKeys } from '../../foundation/typography';

export interface BadgeProps {
  children: string;
  /** @default 'small' */
  size?: 'large' | 'medium' | 'small' | 'tiny';
  color?: string;
  backgroundColor?: string;
  fontWeight?: FontWeightKeys;
  style?: StyleProp<ViewStyle>;
}

const sizeVariant: Record<string, TypographyKeys> = {
  tiny: 't7',
  small: 't7',
  medium: 't6',
  large: 't5',
};

const sizePadding: Record<string, { paddingHorizontal: number; paddingVertical: number }> = {
  tiny: { paddingHorizontal: 4, paddingVertical: 1 },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  medium: { paddingHorizontal: 8, paddingVertical: 3 },
  large: { paddingHorizontal: 10, paddingVertical: 4 },
};

const sizeBorderRadius: Record<string, number> = {
  tiny: 4,
  small: 6,
  medium: 8,
  large: 10,
};

export default function Badge({
  children,
  size = 'small',
  color,
  backgroundColor,
  fontWeight: fontWeightProp,
  style,
}: BadgeProps) {
  const adaptive = useAdaptive();
  const resolvedFontWeight = fontWeightProp ?? (size === 'tiny' ? 'semiBold' : 'bold');

  return (
    <View
      style={[
        styles.container,
        sizePadding[size],
        {
          borderRadius: sizeBorderRadius[size],
          backgroundColor: backgroundColor ?? adaptive.grey100,
        },
        style,
      ]}
    >
      <Txt
        typography={sizeVariant[size]}
        fontWeight={resolvedFontWeight}
        color={color ?? adaptive.grey600}
      >
        {children}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { Badge };
