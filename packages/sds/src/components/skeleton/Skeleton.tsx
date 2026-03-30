/**
 * Skeleton — placeholder shimmer for loading states.
 *
 * Compound: Skeleton.Animate (wrapper with shimmer animation)
 *
 * Usage:
 *   <Skeleton.Animate>
 *     <Skeleton width={200} height={16} />
 *     <Skeleton width={100} height={16} />
 *   </Skeleton.Animate>
 */
import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';

// ── Context for shared animation value ──

const SkeletonContext = createContext<{ progress: SharedValue<number> } | null>(null);

// ── Skeleton.Animate ──

interface SkeletonAnimateProps {
  children: ReactNode;
}

function SkeletonAnimate({ children }: SkeletonAnimateProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  return (
    <SkeletonContext.Provider value={{ progress }}>
      {children}
    </SkeletonContext.Provider>
  );
}

// ── Skeleton ──

export interface SkeletonProps {
  width?: number | string;
  /** @default 16 */
  height?: number;
  /** @default 6 */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonBlock({
  width,
  height = 16,
  borderRadius = 6,
  style,
}: SkeletonProps) {
  const ctx = useContext(SkeletonContext);

  const shimmerStyle = useAnimatedStyle(() => {
    if (!ctx) return {};
    // Shimmer: opacity oscillates between 0.3 and 1
    const opacity = 0.3 + ctx.progress.value * 0.7;
    return { opacity };
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: SdsColors.grey100,
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

// ── Compound export ──

export const Skeleton = Object.assign(SkeletonBlock, {
  Animate: SkeletonAnimate,
});
