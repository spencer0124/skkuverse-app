/**
 * ListFooter — "더 보기" footer for list sections.
 *
 * Compound: ListFooter.Title, ListFooter.Right
 *
 * Usage:
 *   <ListFooter
 *     title={<ListFooter.Title>더 보기</ListFooter.Title>}
 *     right={<ListFooter.Right><Icon /></ListFooter.Right>}
 *   />
 */
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SdsColors } from '@skkuuniverse/shared';
import { useAdaptive } from '../../core';
import { Txt, type TxtProps } from '../txt';
import type { FontWeightKeys, TypographyKeys } from '../../foundation/typography';

// ── Root ──

export interface ListFooterProps {
  title: ReactNode;
  right?: ReactNode;
  /** @default 'full' */
  borderType?: 'full' | 'none';
  onPress?: () => void;
}

function ListFooterRoot({ title, right, borderType = 'full', onPress }: ListFooterProps) {
  const adaptive = useAdaptive();

  const content = (
    <View
      style={[
        styles.container,
        borderType === 'full' && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: adaptive.grey200 },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.titleSlot}>{title}</View>
        {right != null && right}
      </View>
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

// ── ListFooter.Title ──

interface FooterTitleProps extends Omit<TxtProps, 'children'> {
  children: string;
  typography?: TypographyKeys;
  color?: string;
  fontWeight?: FontWeightKeys;
}

function FooterTitle({
  children,
  typography = 't5',
  color,
  fontWeight = 'medium',
  ...rest
}: FooterTitleProps) {
  return (
    <Txt
      typography={typography}
      fontWeight={fontWeight}
      color={color ?? SdsColors.blue500}
      {...rest}
    >
      {children}
    </Txt>
  );
}

// ── ListFooter.Right ──

interface FooterRightProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function FooterRight({ children, style }: FooterRightProps) {
  return <View style={[styles.right, style]}>{children}</View>;
}

// ── Compound export ──

export const ListFooter = Object.assign(ListFooterRoot, {
  Title: FooterTitle,
  Right: FooterRight,
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  titleSlot: {
    flex: 1,
  },
  right: {
    marginLeft: 8,
  },
});
