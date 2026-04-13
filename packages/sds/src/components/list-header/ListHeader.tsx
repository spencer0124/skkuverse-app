/**
 * ListHeader — section header with title/upper/lower/right slots.
 *
 * Compound: ListHeader.TitleParagraph, ListHeader.RightText,
 *           ListHeader.RightArrow, ListHeader.DescriptionParagraph
 *
 * Usage:
 *   <ListHeader
 *     upper={<ListHeader.DescriptionParagraph>Subtitle</ListHeader.DescriptionParagraph>}
 *     title={<ListHeader.TitleParagraph typography="t5" fontWeight="bold">Title</ListHeader.TitleParagraph>}
 *     right={<ListHeader.RightArrow typography="t6">See all</ListHeader.RightArrow>}
 *   />
 */
import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import type { FontWeightKeys, TypographyKeys } from '../../foundation/typography';

// ── Root ──

export interface ListHeaderProps {
  title: ReactNode;
  upper?: ReactNode;
  right?: ReactNode;
  lower?: ReactNode;
  titleViewStyle?: StyleProp<ViewStyle>;
  rightViewStyle?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

function ListHeaderRoot({
  title,
  upper,
  right,
  lower,
  titleViewStyle,
  rightViewStyle,
  onPress,
  style,
}: ListHeaderProps) {
  const content = (
    <View style={[styles.container, style]}>
      {upper != null && <View style={styles.upper}>{upper}</View>}
      <View style={styles.titleRow}>
        <View style={[styles.titleSlot, titleViewStyle]}>{title}</View>
        {right != null && <View style={[styles.rightSlot, rightViewStyle]}>{right}</View>}
      </View>
      {lower != null && <View style={styles.lower}>{lower}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}

// ── TitleParagraph ──

interface TitleParagraphProps {
  children: ReactNode;
  /** @default 't5' */
  typography?: TypographyKeys;
  /** @default 'regular' */
  fontWeight?: FontWeightKeys;
  /** @default adaptive.grey800 */
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

function TitleParagraph({
  children,
  typography = 't5',
  fontWeight = 'regular',
  color,
  numberOfLines,
  style,
}: TitleParagraphProps) {
  const adaptive = useAdaptive();
  return (
    <Txt
      typography={typography}
      fontWeight={fontWeight}
      color={color ?? adaptive.grey800}
      numberOfLines={numberOfLines}
      style={style}
    >
      {children}
    </Txt>
  );
}

// ── RightText ──

interface RightTextProps {
  children: ReactNode;
  /** @default 't7' — TDS allows 't6'|'t7' */
  typography?: TypographyKeys;
  /** @default adaptive.grey700 */
  color?: string;
  style?: StyleProp<TextStyle>;
}

function RightText({ children, typography = 't7', color, style }: RightTextProps) {
  const adaptive = useAdaptive();
  return (
    <Txt
      typography={typography}
      fontWeight="regular"
      color={color ?? adaptive.grey700}
      style={style}
    >
      {children}
    </Txt>
  );
}

// ── RightArrow — text + arrow ›, pressable ──

interface RightArrowProps {
  children: ReactNode;
  /** @default 't7' — TDS allows 't6'|'t7' */
  typography?: TypographyKeys;
  /** @default adaptive.grey700 */
  color?: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

function RightArrow({ children, typography = 't7', color, onPress, style }: RightArrowProps) {
  const adaptive = useAdaptive();
  const resolvedColor = color ?? adaptive.grey700;

  const content = (
    <View style={[styles.rightArrowContainer, style]}>
      <Txt typography={typography} fontWeight="regular" color={resolvedColor}>
        {children}
      </Txt>
      <Txt typography={typography} fontWeight="regular" color={resolvedColor} style={styles.arrowIcon}>
        {' ›'}
      </Txt>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

// ── DescriptionParagraph ──

interface DescriptionParagraphProps {
  children: ReactNode;
  typography?: TypographyKeys;
  fontWeight?: FontWeightKeys;
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

function DescriptionParagraph({
  children,
  typography = 't7',
  fontWeight = 'regular',
  color,
  numberOfLines,
  style,
}: DescriptionParagraphProps) {
  return (
    <Txt
      typography={typography}
      fontWeight={fontWeight}
      color={color ?? SdsColors.grey500}
      numberOfLines={numberOfLines}
      style={style}
    >
      {children}
    </Txt>
  );
}

// ── Compound export ──

export const ListHeader = Object.assign(ListHeaderRoot, {
  TitleParagraph,
  RightText,
  RightArrow,
  DescriptionParagraph,
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  upper: {
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleSlot: {
    flex: 1,
  },
  rightSlot: {
    marginLeft: 8,
  },
  lower: {
    marginTop: 4,
  },
  rightArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    marginLeft: 2,
  },
});
