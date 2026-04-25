/**
 * Tab — horizontal tab bar with animated indicator (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <Tab value="home" onChange={setTab}>
 *     <Tab.Item value="home">Home</Tab.Item>
 *     <Tab.Item value="search">Search</Tab.Item>
 *   </Tab>
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
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { useControlled } from '../../utils';
import { springConfig } from '../../foundation/easings';
import { Txt } from '../txt';

// ── Context ──

interface TabContextValue {
  value: string;
  onChange: (value: string) => void;
  fluid: boolean;
  size: 'large' | 'small';
  registerLayout: (value: string, x: number, width: number) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

// ── Tab.Item ──

export interface TabItemProps {
  value: string;
  children: ReactNode;
  /** Red dot notification indicator */
  redBean?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
}

function TabItem({ value, children, redBean = false, style, onPress }: TabItemProps) {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('Tab.Item must be used within <Tab>');

  const adaptive = useAdaptive();
  const isActive = ctx.value === value;

  const handlePress = useCallback((event: GestureResponderEvent) => {
    onPress?.(event);
    ctx.onChange(value);
  }, [onPress, ctx, value]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      ctx.registerLayout(value, x, width);
    },
    [ctx, value],
  );

  return (
    <Pressable
      onPress={handlePress}
      onLayout={handleLayout}
      style={[
        styles.tabItem,
        !ctx.fluid && styles.tabItemEqual,
        ctx.fluid && styles.tabItemFluid,
        style,
      ]}
    >
      <View style={styles.tabItemInner}>
        <Txt
          typography={ctx.size === 'large' ? 't5' : 't6'}
          fontWeight={isActive ? 'semiBold' : 'regular'}
          color={isActive ? adaptive.grey900 : adaptive.grey500}
        >
          {children}
        </Txt>
        {redBean && <View style={styles.redBean} />}
      </View>
    </Pressable>
  );
}

// ── Tab Root ──

export interface TabProps {
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  /** @default false — true: text width + horizontal scroll */
  fluid?: boolean;
  /** @default 'large' */
  size?: 'large' | 'small';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function TabRoot({
  value: controlledValue,
  onChange: controlledOnChange,
  defaultValue,
  fluid = false,
  size = 'large',
  children,
  style,
}: TabProps) {
  const adaptive = useAdaptive();

  // Derive default from first child
  let derivedDefault = defaultValue ?? '';
  if (!derivedDefault) {
    Children.forEach(children, (child) => {
      if (!derivedDefault && React.isValidElement<{ value?: string }>(child) && child.props.value) {
        derivedDefault = child.props.value;
      }
    });
  }

  const [value, setValue] = useControlled({
    controlledValue,
    defaultValue: derivedDefault,
  });

  const handleChange = useCallback(
    (next: string) => {
      controlledOnChange?.(next);
      setValue(next);
    },
    [controlledOnChange, setValue],
  );

  // Layout tracking for indicator
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const [ready, setReady] = useState(false);

  const registerLayout = useCallback(
    (itemValue: string, x: number, width: number) => {
      layoutsRef.current[itemValue] = { x, width };
      // Update indicator if this is the active item
      if (itemValue === value) {
        indicatorX.value = withSpring(x, springConfig('quick'));
        indicatorW.value = withSpring(width, springConfig('quick'));
        if (!ready) setReady(true);
      }
    },
    [value, indicatorX, indicatorW, ready],
  );

  useEffect(() => {
    const layout = layoutsRef.current[value];
    if (layout) {
      indicatorX.value = withSpring(layout.x, springConfig('quick'));
      indicatorW.value = withSpring(layout.width, springConfig('quick'));
    }
  }, [value, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const content = (
    <TabContext.Provider value={{ value, onChange: handleChange, fluid, size, registerLayout }}>
      <View style={[styles.container, style]}>
        <View style={styles.tabRow}>{children}</View>
        {/* Bottom border */}
        <View style={[styles.bottomBorder, { backgroundColor: adaptive.grey200 }]} />
        {/* Active indicator */}
        {ready && (
          <Animated.View
            style={[
              styles.indicator,
              { backgroundColor: adaptive.grey900 },
              indicatorStyle,
            ]}
          />
        )}
      </View>
    </TabContext.Provider>
  );

  if (fluid) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fluidScroll}>
        {content}
      </ScrollView>
    );
  }

  return content;
}

// ── Compound Export ──

export const Tab = Object.assign(TabRoot, {
  Item: TabItem,
});

const styles = StyleSheet.create({
  fluidScroll: {
    flexGrow: 0,
  },
  container: {
    position: 'relative',
  },
  tabRow: {
    flexDirection: 'row',
  },
  tabItem: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemEqual: {
    flex: 1,
  },
  tabItemFluid: {
    paddingHorizontal: 16,
  },
  tabItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redBean: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SdsColors.red500,
    marginLeft: 4,
    marginTop: -8,
  },
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
});
