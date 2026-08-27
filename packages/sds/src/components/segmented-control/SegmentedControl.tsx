/**
 * SegmentedControl — pill-style segmented selector (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <SegmentedControl value="a" onValueChange={setValue}>
 *     <SegmentedControl.Item value="a">Tab A</SegmentedControl.Item>
 *     <SegmentedControl.Item value="b">Tab B</SegmentedControl.Item>
 *   </SegmentedControl>
 */
import React, {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { springConfig } from '../../foundation/easings';
import { Txt } from '../txt';

// ── Context ──

interface SegmentedContextValue {
  value: string;
  onValueChange: (value: string) => void;
  registerItem: (value: string, index: number) => void;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

// ── Item ──

export interface SegmentedControlItemProps {
  value: string;
  children: ReactNode;
  typography?: import('../../foundation/typography').TypographyKeys;
  style?: StyleProp<ViewStyle>;
}

function SegmentedControlItem({ value, children, typography = 't6', style }: SegmentedControlItemProps) {
  const ctx = useContext(SegmentedContext);
  if (!ctx) throw new Error('SegmentedControl.Item must be used within <SegmentedControl>');

  const isActive = ctx.value === value;
  const adaptive = useAdaptive();

  const handlePress = useCallback(() => {
    ctx.onValueChange(value);
  }, [ctx, value]);

  return (
    <Pressable onPress={handlePress} style={[styles.item, style]}>
      <Txt
        typography={typography}
        fontWeight={isActive ? 'semiBold' : 'regular'}
        color={isActive ? adaptive.grey900 : adaptive.grey500}
      >
        {children}
      </Txt>
    </Pressable>
  );
}

// ── Root ──

export interface SegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function SegmentedControlRoot({
  value,
  onValueChange,
  children,
  style,
}: SegmentedControlProps) {
  const adaptive = useAdaptive();
  const itemCount = Children.count(children);
  const [containerWidth, setContainerWidth] = useState(0);
  const itemValues = useRef<string[]>([]);

  // Collect item values from children
  const values: string[] = [];
  Children.forEach(children, (child) => {
    if (React.isValidElement<{ value?: string }>(child) && child.props.value) {
      values.push(child.props.value);
    }
  });
  itemValues.current = values;

  const activeIndex = values.indexOf(value);
  const padding = 2;
  const itemWidth = itemCount > 0 ? (containerWidth - padding * 2) / itemCount : 0;

  const translateX = useSharedValue(activeIndex * itemWidth);

  useEffect(() => {
    if (itemWidth > 0) {
      translateX.value = withSpring(activeIndex * itemWidth, springConfig('quick'));
    }
  }, [activeIndex, itemWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: itemWidth,
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // The indicator has to be the track's shape, inset by the track's padding —
  // a consumer that makes the track a capsule (the campus toggle sets
  // `borderRadius` to half its height) was getting a rounded rectangle sitting
  // inside it, which reads as the wrong size rather than as the wrong radius.
  const trackRadius = StyleSheet.flatten(style)?.borderRadius;
  const indicatorRadius =
    typeof trackRadius === 'number' ? Math.max(0, trackRadius - padding) : 8;

  const registerItem = useCallback((_value: string, _index: number) => {}, []);

  return (
    <SegmentedContext.Provider value={{ value, onValueChange, registerItem }}>
      <View
        style={[styles.container, { backgroundColor: adaptive.grey100 }, style]}
        onLayout={handleLayout}
      >
        {/* Indicator */}
        {itemWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor: SdsColors.background,
                // `bottom`, NOT `height: '100%'`. A percentage height resolves
                // against the container's padding box, so with `top: padding`
                // the indicator ran past the bottom edge and only `overflow:
                // 'hidden'` hid it — leaving it inset at the top and flush at
                // the bottom. Pinning both edges makes it symmetric.
                top: padding,
                bottom: padding,
                borderRadius: indicatorRadius,
              },
              indicatorStyle,
            ]}
          />
        )}
        {/* Items */}
        {children}
      </View>
    </SegmentedContext.Provider>
  );
}

// ── Compound Export ──

export const SegmentedControl = Object.assign(SegmentedControlRoot, {
  Item: SegmentedControlItem,
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    // `top`, `bottom` and `borderRadius` are set inline: they follow the
    // container's padding and the radius the consumer gave the track.
    left: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
});
