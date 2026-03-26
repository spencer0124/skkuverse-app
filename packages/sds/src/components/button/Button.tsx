/**
 * Button — beautified from TDS Button.js, rewritten with reanimated.
 *
 * Props match TDS Button API exactly (see .d.ts).
 * Animation: press scale + opacity via reanimated (UI thread).
 */
import React, {
  Children,
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuuniverse/shared';
import { ThemeProvider, useTheme } from '../../core';
import { springConfig, timingConfig } from '../../foundation/easings';
import { Txt } from '../txt';

// ── Types ──

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  /** @default 'primary' */
  type?: 'primary' | 'danger' | 'light' | 'dark';
  /** @default 'fill' */
  style?: 'fill' | 'weak';
  /** @default 'inline' */
  display?: 'block' | 'full' | 'inline';
  /** @default 'big' */
  size?: 'big' | 'large' | 'medium' | 'tiny';
  /** @default false */
  loading?: boolean;
  /** @default false */
  disabled?: boolean;
  viewStyle?: StyleProp<ViewStyle>;
  color?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftAccessory?: ReactNode;
}

type PointerEvents = Pick<ViewProps, 'pointerEvents'>;

// ── Size → Typography mapping (from TDS) ──

const sizeToTypography = {
  tiny: 't7' as const,
  medium: 't6' as const,
  large: 'st9' as const,
  big: 'st9' as const,
};

// ── Type → primary color mapping ──

const typeToColor: Record<string, string> = {
  danger: SdsColors.red500,
  light: '#FFFFFFDE', // whiteOpacity900
  dark: SdsColors.grey700,
};

// ── Container styles per size (from TDS) ──

export const containerStylesBySize = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  tiny: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    minHeight: 32,
    minWidth: 52,
    borderRadius: 8,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    minHeight: 38,
    minWidth: 64,
    borderRadius: 10,
  },
  large: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    minHeight: 48,
    minWidth: 80,
    borderRadius: 14,
  },
  big: {
    paddingHorizontal: 28,
    paddingVertical: 2,
    minHeight: 56,
    minWidth: 96,
    borderRadius: 16,
  },
});

const displayStyles = StyleSheet.create({
  inline: { alignSelf: 'flex-start' as const },
  block: {},
  full: {},
});

const containerDisplayStyles = StyleSheet.create({
  inline: {},
  block: {},
  full: { borderRadius: 0 },
});

// ── Inner Button (uses theme context) ──

const ButtonInner = forwardRef<View, ButtonProps & PointerEvents>(function ButtonInner(
  {
    children,
    onPress,
    size = 'big',
    style: buttonStyle = 'fill',
    display = 'inline',
    disabled = false,
    loading = false,
    viewStyle,
    color: colorOverride,
    containerStyle,
    textStyle,
    pointerEvents,
    leftAccessory,
    onPressIn,
    onPressOut,
    ...restProps
  },
  ref,
) {
  const { token } = useTheme();
  const isInteractive = !(disabled || loading);

  // Resolve colors from theme
  const colors = useMemo(() => {
    if (buttonStyle === 'weak') {
      return {
        bg: token.button.backgroundWeakColor,
        text: token.button.textWeakColor,
        dim: token.button.dimWeakColor,
        loader: token.button.loaderWeakColor,
      };
    }
    return {
      bg: token.button.backgroundFillColor,
      text: token.button.textFillColor,
      dim: token.button.dimFillColor,
      loader: token.button.loaderFillColor,
    };
  }, [buttonStyle, token.button]);

  // ── Reanimated shared values ──
  const pressed = useSharedValue(0); // 0 = not pressed, 1 = pressed
  const dimOpacity = useSharedValue(0);

  const handlePressIn = useCallback(
    (e: any) => {
      onPressIn?.(e);
      if (isInteractive) {
        pressed.value = withSpring(1, springConfig('rapid'));
        dimOpacity.value = withSpring(
          buttonStyle === 'fill' ? 0.26 : 0.13,
          springConfig('quick'),
        );
      }
    },
    [onPressIn, isInteractive, pressed, dimOpacity, buttonStyle],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      onPressOut?.(e);
      if (isInteractive) {
        pressed.value = withSpring(0, springConfig('rapid'));
        dimOpacity.value = withSpring(0, springConfig('quick'));
      }
    },
    [onPressOut, isInteractive, pressed, dimOpacity],
  );

  // ── Animated styles ──
  const animatedContainer = useAnimatedStyle(() => {
    const scale = display === 'inline'
      ? 1 - pressed.value * 0.04
      : 1;
    return {
      opacity: disabled ? (buttonStyle === 'fill' ? 0.26 : 1) : 1,
      transform: [{ scale }],
    };
  });

  const animatedDim = useAnimatedStyle(() => ({
    opacity: dimOpacity.value,
  }));

  const animatedText = useAnimatedStyle(() => ({
    opacity: disabled && buttonStyle !== 'fill' ? 0.38 : 1,
  }));

  // ── Loader dots (staggered pulse: 0.3 → 1.0 → 0.3, 150ms stagger) ──
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    if (!loading) return;
    const duration = 400;
    const pulse = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    dot1.value = pulse;
    dot2.value = withDelay(150, pulse);
    dot3.value = withDelay(300, pulse);
  }, [loading]);

  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  // Render children with Txt wrapper for strings
  const renderedChildren = Children.map(children, (child, idx) =>
    typeof child === 'string' || typeof child === 'number' ? (
      <Txt
        typography={sizeToTypography[size]}
        color={colorOverride ?? colors.text}
        style={textStyle}
        fontWeight="semiBold"
      >
        {child}
      </Txt>
    ) : (
      <Fragment key={idx}>{child}</Fragment>
    ),
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={isInteractive ? onPress : undefined}
      pointerEvents={pointerEvents}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[displayStyles[display], viewStyle]}
      ref={ref}
      {...restProps}
      accessibilityState={{ disabled, ...restProps.accessibilityState }}
    >
      <Animated.View
        style={[
          containerStylesBySize.base,
          containerStylesBySize[size],
          containerDisplayStyles[display],
          animatedContainer,
          containerStyle,
        ]}
      >
        {/* Background */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.bg },
          ]}
        />

        {/* Content */}
        <Animated.View
          style={[{ flexDirection: 'row', alignItems: 'center' }, animatedText]}
        >
          {leftAccessory}
          {renderedChildren}
        </Animated.View>

        {/* Loading dots */}
        {loading && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
            ]}
          >
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {[dotStyle1, dotStyle2, dotStyle3].map((style, i) => (
                <Animated.View
                  key={i}
                  style={[
                    { width: 8, height: 8, backgroundColor: colors.loader, borderRadius: 99 },
                    style,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Dim overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.dim },
            animatedDim,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

// ── Public Button (wraps with ThemeProvider for type variants) ──

export const Button = forwardRef<View, ButtonProps & PointerEvents>(
  function Button({ type, ...props }, ref) {
    const tokenOverride = useMemo(() => {
      if (type === undefined || type === 'primary') return {};
      return { color: { primary: typeToColor[type] } };
    }, [type]);

    if (type === undefined || type === 'primary') {
      return <ButtonInner {...props} ref={ref} />;
    }

    return (
      <ThemeProvider token={tokenOverride}>
        <ButtonInner {...props} ref={ref} />
      </ThemeProvider>
    );
  },
);
