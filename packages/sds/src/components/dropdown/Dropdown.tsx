/**
 * Dropdown — expandable option list (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <Dropdown open={open} onToggle={setOpen} trigger={<Button>Select</Button>}>
 *     <Dropdown.Item onPress={() => pick('a')}>Option A</Dropdown.Item>
 *     <Dropdown.Item onPress={() => pick('b')}>Option B</Dropdown.Item>
 *   </Dropdown>
 */
import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuuniverse/shared';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';

// ── Dropdown.Item ──

export interface DropdownItemProps {
  children: ReactNode;
  onPress?: () => void;
  /** @default false */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function DropdownItem({
  children,
  onPress,
  disabled = false,
  style,
}: DropdownItemProps) {
  const adaptive = useAdaptive();

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress?.();
  }, [disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.item,
        pressed && { backgroundColor: adaptive.grey100 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Txt typography="t6" color={adaptive.grey900}>{children}</Txt>
      ) : (
        children
      )}
    </Pressable>
  );
}

// ── Dropdown Root ──

export interface DropdownProps {
  children: ReactNode;
  trigger: ReactNode;
  /** Controlled open state */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

function DropdownRoot({
  children,
  trigger,
  open: controlledOpen,
  onToggle,
  style,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;

  const opacity = useSharedValue(0);
  const mounted = useSharedValue(false);

  useEffect(() => {
    if (isOpen) {
      mounted.value = true;
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      // Delay unmount
      const timeout = setTimeout(() => {
        mounted.value = false;
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, opacity, mounted]);

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    onToggle?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  }, [isOpen, onToggle, controlledOpen]);

  const listStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    display: mounted.value || opacity.value > 0 ? 'flex' : 'none',
  }));

  return (
    <View style={[styles.container, style]}>
      <Pressable onPress={handleToggle}>{trigger}</Pressable>
      <Animated.View style={[styles.list, listStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

// ── Compound Export ──

export const Dropdown = Object.assign(DropdownRoot, {
  Item: DropdownItem,
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  list: {
    marginTop: 4,
    backgroundColor: SdsColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
