/**
 * ProgressBar — animated progress indicator.
 *
 * Usage:
 *   <ProgressBar progress={60} size="normal" />
 *   <ProgressBar progress={progress} size="bold" color={colors.green500} withAnimation />
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SdsColors } from '@skkuuniverse/shared';

// ── Size → height ──

const sizeHeight = {
  light: 2,
  normal: 4,
  bold: 8,
} as const;

export interface ProgressBarProps {
  /** 0–100 */
  progress: number;
  /** @default 'normal' */
  size?: 'light' | 'normal' | 'bold';
  color?: string;
  /** @default false */
  withAnimation?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  size = 'normal',
  color,
  withAnimation = false,
  style,
}: ProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useSharedValue(0);
  const height = sizeHeight[size];
  const fillColor = color ?? SdsColors.blue500;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  useEffect(() => {
    if (trackWidth === 0) return;
    const targetWidth = (clampedProgress / 100) * trackWidth;
    if (withAnimation) {
      fillWidth.value = withTiming(targetWidth, { duration: 300 });
    } else {
      fillWidth.value = targetWidth;
    }
  }, [clampedProgress, trackWidth, withAnimation, fillWidth]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        { height, borderRadius: height / 2 },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { height, borderRadius: height / 2, backgroundColor: fillColor },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: SdsColors.grey100,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
