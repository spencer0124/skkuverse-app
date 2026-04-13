/**
 * Txt — core typography component (reimplemented from TDS .d.ts).
 *
 * Replaces raw <Text> with theme-aware typography, font weight, and color.
 *
 * Usage:
 *   <Txt typography="t3" fontWeight="bold" color={colors.grey900}>Title</Txt>
 */
import React, { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useAdaptive } from '../../core';
import { useTypographyTheme } from '../../core/TypographyProvider';
import {
  FONT_FAMILY,
  fontFamilyByWeight,
  fontWeightMap,
  type FontWeightKeys,
  type TypographyKeys,
} from '../../foundation/typography';

export interface TxtStyleProps {
  /** @default 't5' */
  typography?: TypographyKeys;
  /** @default 'regular' */
  fontWeight?: FontWeightKeys;
  /** @default adaptive.grey900 */
  color?: string;
  numberOfLines?: number;
  textAlign?: TextStyle['textAlign'];
}

export type TxtProps = TxtStyleProps &
  ComponentProps<typeof Text> & {
    children: ReactNode;
    style?: StyleProp<TextStyle>;
  };

export function toFontWeightStyle(fontWeightKey: FontWeightKeys) {
  return {
    fontWeight: fontWeightMap[fontWeightKey] as TextStyle['fontWeight'],
    fontFamily: fontFamilyByWeight[fontWeightKey],
  };
}

const Txt = forwardRef<Text, TxtProps>(function Txt(
  {
    typography = 't5',
    fontWeight = 'regular',
    color,
    numberOfLines,
    textAlign,
    style,
    children,
    ...restProps
  },
  ref,
) {
  const adaptive = useAdaptive();
  const { typography: typographyTheme } = useTypographyTheme();

  const resolvedColor = color ?? adaptive.grey900;
  const typo = typographyTheme[typography];

  return (
    <Text
      ref={ref}
      allowFontScaling={false}
      style={[
        styles.base,
        typo,
        { color: resolvedColor, textAlign },
        toFontWeightStyle(fontWeight),
        style,
      ]}
      numberOfLines={numberOfLines}
      {...restProps}
    >
      {children}
    </Text>
  );
});

const styles = StyleSheet.create({
  base: {
    fontFamily: FONT_FAMILY,
    includeFontPadding: false,
  },
});

export default Txt;
export { Txt };
