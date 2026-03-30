/**
 * Toast — temporary notification overlay.
 *
 * Compound: Toast.Icon, Toast.Button
 *
 * Usage:
 *   <Toast
 *     open={show}
 *     text="저장되었어요"
 *     icon={<Toast.Icon type="check" />}
 *     onClose={() => setShow(false)}
 *   />
 */
import React, { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { SdsColors } from '@skkuverse/shared';
import { springConfig } from '../../foundation/easings';
import { Txt } from '../txt';

// ── Types ──

export interface ToastProps {
  open: boolean;
  text: string;
  /** @default 'bottom' */
  position?: 'top' | 'bottom';
  icon?: ReactNode;
  /** Duration in seconds @default 3 */
  duration?: number;
  button?: ReactNode;
  bottomOffset?: number;
  onClose: () => void;
  onExited?: () => void;
  onEntered?: () => void;
}

// ── Main Toast ──

function ToastMain({
  open,
  text,
  position = 'bottom',
  icon,
  duration = 3,
  button,
  bottomOffset,
  onClose,
  onExited,
  onEntered,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(position === 'bottom' ? 100 : -100);
  const opacity = useSharedValue(0);
  const mounted = useSharedValue(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      mounted.value = true;
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, springConfig('quick'), (finished) => {
        if (finished && onEntered) runOnJS(onEntered)();
      });

      // Auto-dismiss
      if (timerRef.current) clearTimeout(timerRef.current);
      const effectiveDuration = button ? Math.max(duration, 5) : duration;
      timerRef.current = setTimeout(() => {
        onClose();
      }, effectiveDuration * 1000);
    } else if (mounted.value) {
      if (timerRef.current) clearTimeout(timerRef.current);
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(
        position === 'bottom' ? 100 : -100,
        { duration: 200 },
        (finished) => {
          if (finished) {
            mounted.value = false;
            if (onExited) runOnJS(onExited)();
          }
        },
      );
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    display: mounted.value ? 'flex' : 'none',
  }));

  const positionStyle =
    position === 'bottom'
      ? { bottom: (bottomOffset ?? 20) + insets.bottom }
      : { top: 20 + insets.top };

  return (
    <Animated.View
      style={[styles.toastContainer, positionStyle, containerStyle]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <View style={styles.toast}>
        <View style={styles.toastContent}>
          {icon != null && <View style={styles.iconSlot}>{icon}</View>}
          <Txt typography="t6" fontWeight="medium" color="#FFFFFF" style={styles.toastText}>
            {text}
          </Txt>
        </View>
        {button != null && <View style={styles.buttonSlot}>{button}</View>}
      </View>
    </Animated.View>
  );
}

// ── Toast.Icon ──

type IconType = 'check' | 'warning' | 'error' | 'info';

interface ToastIconProps {
  type: IconType;
  size?: number;
}

const iconColors: Record<IconType, string> = {
  check: SdsColors.green500,
  warning: '#FFA726',
  error: SdsColors.red500,
  info: SdsColors.blue500,
};

function ToastIcon({ type, size = 20 }: ToastIconProps) {
  const color = iconColors[type];

  if (type === 'check') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} fill={color} />
        <Path d="M8 12L11 15L16 9" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (type === 'error') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} fill={color} />
        <Path d="M8 8L16 16M16 8L8 16" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  // warning / info — exclamation mark
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} />
      <Path d="M12 8V13" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={16.5} r={1.2} fill="#FFFFFF" />
    </Svg>
  );
}

// ── Toast.Button ──

interface ToastButtonProps {
  text: string;
  onPress: () => void;
}

function ToastButton({ text, onPress }: ToastButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Txt typography="t7" fontWeight="bold" color={SdsColors.blue200}>
        {text}
      </Txt>
    </Pressable>
  );
}

// ── Compound export ──

export const Toast = Object.assign(ToastMain, {
  Icon: ToastIcon,
  Button: ToastButton,
});

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10000,
  },
  toast: {
    backgroundColor: 'rgba(33, 33, 33, 0.92)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSlot: {
    marginRight: 10,
  },
  toastText: {
    flex: 1,
  },
  buttonSlot: {
    marginLeft: 12,
  },
});
