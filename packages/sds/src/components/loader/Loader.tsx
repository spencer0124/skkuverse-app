/**
 * Loader — spinning loader indicator.
 *
 * Compound: Loader.Delay, Loader.Centered, Loader.FullScreen
 *
 * Usage:
 *   <Loader size="medium" type="primary" />
 *   <Loader.FullScreen label="Loading..." />
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { SdsColors } from '@skkuuniverse/shared';
import { Txt } from '../txt';

// ── Size map ──

const sizeMap = {
  small: 24,
  medium: 40,
  large: 56,
} as const;

// ── Color map ──

const typeColorMap = {
  primary: SdsColors.blue500,
  dark: SdsColors.grey900,
  light: '#FFFFFF',
} as const;

// ── Types ──

export interface LoaderProps {
  /** @default 'large' */
  size?: 'small' | 'medium' | 'large';
  /** @default 'primary' */
  type?: 'primary' | 'dark' | 'light';
  label?: string;
  /** Delay in ms before showing */
  delay?: number;
  /** Override stroke color (takes priority over type) */
  customStrokeColor?: string;
  /** Override size in px (takes priority over size) */
  customSize?: number;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}

// ── Main Loader ──

function LoaderMain({ size = 'large', type = 'primary', label, delay, customStrokeColor, customSize, style: containerStyleProp }: LoaderProps) {
  const [visible, setVisible] = useState(!delay);
  const rotation = useSharedValue(0);
  const px = customSize ?? sizeMap[size];
  const color = customStrokeColor ?? typeColorMap[type];
  const strokeWidth = px < 30 ? 2.5 : 3;
  const radius = (px - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useEffect(() => {
    if (delay) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <View style={[styles.loaderContainer, containerStyleProp]}>
      <Animated.View style={[{ width: px, height: px }, animatedStyle]}>
        <Svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
          <Circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
            fill="none"
            opacity={0.9}
          />
          <Circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.15}
          />
        </Svg>
      </Animated.View>
      {label != null && (
        <Txt
          typography="t7"
          color={type === 'light' ? '#FFFFFFDE' : SdsColors.grey600}
          style={styles.label}
        >
          {label}
        </Txt>
      )}
    </View>
  );
}

// ── Loader.Delay ──

interface DelayProps {
  children: ReactNode;
  /** @default 700 */
  delay?: number;
}

function LoaderDelay({ children, delay = 700 }: DelayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;
  return <>{children}</>;
}

// ── Loader.Centered ──

function LoaderCentered(props: LoaderProps) {
  return (
    <View style={styles.centered}>
      <LoaderMain {...props} />
    </View>
  );
}

// ── Loader.FullScreen ──

function LoaderFullScreen(props: LoaderProps) {
  return (
    <View style={styles.fullScreen}>
      <LoaderMain {...props} />
    </View>
  );
}

// ── Compound export ──

export const Loader = Object.assign(LoaderMain, {
  Delay: LoaderDelay,
  Centered: LoaderCentered,
  FullScreen: LoaderFullScreen,
});

const styles = StyleSheet.create({
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
