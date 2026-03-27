/**
 * Navbar — top navigation bar (reimplemented from TDS "Top" .d.ts).
 *
 * Usage:
 *   <Navbar
 *     left={<Navbar.BackButton onPress={goBack} />}
 *     title="Page Title"
 *     right={<Navbar.TextButton onPress={save}>Save</Navbar.TextButton>}
 *   />
 */
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';

const NAVBAR_HEIGHT = 56;

// ── BackButton ──

export interface NavbarBackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function BackButton({ onPress, style }: NavbarBackButtonProps) {
  const adaptive = useAdaptive();

  return (
    <Pressable onPress={onPress} style={[styles.iconButton, style]} hitSlop={8}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M15 18l-6-6 6-6"
          stroke={adaptive.grey900}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

// ── CloseButton ──

export interface NavbarCloseButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function CloseButton({ onPress, style }: NavbarCloseButtonProps) {
  const adaptive = useAdaptive();

  return (
    <Pressable onPress={onPress} style={[styles.iconButton, style]} hitSlop={8}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M18 6L6 18M6 6l12 12"
          stroke={adaptive.grey900}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

// ── Title ──

export interface NavbarTitleProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function Title({ children, style }: NavbarTitleProps) {
  const adaptive = useAdaptive();

  return (
    <View style={[styles.titleContainer, style]}>
      {typeof children === 'string' ? (
        <Txt typography="t5" fontWeight="semiBold" color={adaptive.grey900} numberOfLines={1}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </View>
  );
}

// ── TextButton ──

export interface NavbarTextButtonProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function TextButton({ children, onPress, style }: NavbarTextButtonProps) {
  const adaptive = useAdaptive();

  return (
    <Pressable onPress={onPress} style={[styles.textButton, style]}>
      {typeof children === 'string' ? (
        <Txt typography="t6" fontWeight="medium" color={adaptive.grey700}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </Pressable>
  );
}

// ── Navbar Root ──

export interface NavbarProps {
  left?: ReactNode;
  title?: string | ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function NavbarRoot({ left, title, right, style }: NavbarProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Left */}
      <View style={styles.leftSlot}>{left}</View>

      {/* Center Title */}
      <View style={styles.centerSlot}>
        {title != null && (
          typeof title === 'string' ? <Title>{title}</Title> : title
        )}
      </View>

      {/* Right */}
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

// ── Compound Export ──

export const Navbar = Object.assign(NavbarRoot, {
  BackButton,
  CloseButton,
  Title,
  TextButton,
});

const styles = StyleSheet.create({
  container: {
    height: NAVBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  leftSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  centerSlot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 56,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    zIndex: 1,
  },
  iconButton: {
    padding: 8,
  },
  titleContainer: {
    alignItems: 'center',
  },
  textButton: {
    padding: 8,
  },
});
