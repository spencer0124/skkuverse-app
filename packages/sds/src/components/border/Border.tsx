/**
 * Border — divider/spacer component (beautified from TDS).
 *
 * Types:
 *   'full'      — hairline, full width
 *   'padding24' — hairline, 24px horizontal padding
 *   'height16'  — 16px height spacer (no line)
 */
import React, { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAdaptive } from '../../core';

export type BorderType = 'full' | 'padding24' | 'height16';

interface BaseProps {
  type?: BorderType;
  height?: number;
}

type Props = BaseProps & ComponentProps<typeof View>;

export default function Border({
  type = 'full',
  style,
  height,
  ...restProps
}: Props) {
  const adaptive = useAdaptive();

  if (type === 'height16') {
    return (
      <View
        style={[{ height: height ?? 16, backgroundColor: adaptive.grey50 }, style]}
        {...restProps}
      />
    );
  }

  return (
    <View
      style={[
        styles.hairline,
        { backgroundColor: adaptive.grey200 },
        type === 'padding24' && styles.padding24,
        style,
      ]}
      {...restProps}
    />
  );
}

const styles = StyleSheet.create({
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  padding24: {
    marginHorizontal: 24,
  },
});

export { Border };
