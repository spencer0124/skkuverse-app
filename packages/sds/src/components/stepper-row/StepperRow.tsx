/**
 * StepperRow — step indicator row (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <StepperRow
 *     left={<StepperRow.NumberIcon number={1} />}
 *     center={<StepperRow.Texts type="A" title="Step 1" description="Do something" />}
 *     right={<StepperRow.RightArrow onPress={() => {}} label="Next" />}
 *   />
 */
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SdsColors } from '@skkuuniverse/shared';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import { Button, type ButtonProps } from '../button';
import type { TypographyKeys } from '../../foundation/typography';

// ── NumberIcon ──

export interface NumberIconProps {
  number: number; // 1-9
  style?: StyleProp<ViewStyle>;
}

function NumberIcon({ number, style }: NumberIconProps) {
  return (
    <View style={[styles.numberIcon, style]}>
      <Txt typography="t7" fontWeight="bold" color={SdsColors.background}>
        {number}
      </Txt>
    </View>
  );
}

// ── Texts ──

type TextsType = 'A' | 'B' | 'C';

const textsConfig: Record<TextsType, { title: TypographyKeys; description: TypographyKeys }> = {
  A: { title: 't5', description: 't6' },
  B: { title: 't4', description: 't6' },
  C: { title: 't5', description: 't7' },
};

export interface StepperTextsProps {
  type?: TextsType;
  title: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
}

function Texts({ type = 'A', title, description, style }: StepperTextsProps) {
  const adaptive = useAdaptive();
  const config = textsConfig[type];

  return (
    <View style={[styles.texts, style]}>
      <Txt typography={config.title} fontWeight="semiBold" color={adaptive.grey900}>
        {title}
      </Txt>
      {description != null && (
        <Txt typography={config.description} color={adaptive.grey600} style={styles.description}>
          {description}
        </Txt>
      )}
    </View>
  );
}

// ── RightArrow ──

export interface RightArrowProps {
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function RightArrow({ label, onPress, style }: RightArrowProps) {
  const adaptive = useAdaptive();

  return (
    <Pressable onPress={onPress} style={[styles.rightArrow, style]}>
      {label != null && (
        <Txt typography="t6" color={adaptive.grey500}>
          {label}
        </Txt>
      )}
      <Txt typography="t5" color={adaptive.grey400}>
        ›
      </Txt>
    </Pressable>
  );
}

// ── RightButton ──

export interface RightButtonProps extends Omit<ButtonProps, 'size' | 'type'> {
  /** @default 'tiny' */
  size?: ButtonProps['size'];
  /** @default 'primary' */
  type?: ButtonProps['type'];
}

function RightButton({ size = 'tiny', type = 'primary', children, ...rest }: RightButtonProps) {
  return (
    <Button size={size} type={type} {...rest}>
      {children}
    </Button>
  );
}

// ── StepperRow Root ──

export interface StepperRowProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  /** @default false — hide vertical connector line */
  hideLine?: boolean;
  style?: StyleProp<ViewStyle>;
}

function StepperRowRoot({
  left,
  center,
  right,
  hideLine = false,
  style,
}: StepperRowProps) {
  const adaptive = useAdaptive();

  return (
    <View style={[styles.container, style]}>
      {/* Left column (icon + connector line) */}
      <View style={styles.leftColumn}>
        {left}
        {!hideLine && (
          <View style={[styles.connector, { backgroundColor: adaptive.grey200 }]} />
        )}
      </View>

      {/* Center (texts) */}
      <View style={styles.centerColumn}>{center}</View>

      {/* Right */}
      {right != null && <View style={styles.rightColumn}>{right}</View>}
    </View>
  );
}

// ── Compound Export ──

export const StepperRow = Object.assign(StepperRowRoot, {
  NumberIcon,
  Texts,
  RightArrow,
  RightButton,
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  leftColumn: {
    alignItems: 'center',
    marginRight: 12,
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: 8,
    borderRadius: 1,
  },
  centerColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  rightColumn: {
    justifyContent: 'center',
    marginLeft: 12,
  },
  numberIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SdsColors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    gap: 4,
  },
  description: {
    marginTop: 2,
  },
  rightArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
