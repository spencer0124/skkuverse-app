/**
 * ListRow — complex list item component (reimplemented from TDS .d.ts).
 *
 * Compound component:
 *   ListRow          — main container with left/contents/right slots
 *   ListRow.Texts    — text layout (1/2/3 row variants)
 *   ListRow.LeftText — single left text
 *
 * Usage:
 *   <ListRow
 *     left={<ListRow.Icon name="arrow" />}
 *     contents={<ListRow.Texts type="2RowTypeA" top="Title" bottom="Subtitle" />}
 *     right={<Badge>New</Badge>}
 *     onPress={() => {}}
 *   />
 */
import React, { forwardRef, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { Txt, type TxtProps } from '../txt';
import type { FontWeightKeys, TypographyKeys } from '../../foundation/typography';

// ── Types ──

export interface ListRowRef {
  blink: (duration?: number) => void;
  shine: (playCount?: number) => void;
}

export interface ListRowProps extends AccessibilityProps {
  left?: ReactNode;
  contents?: ReactNode;
  right?: ReactNode;
  withArrow?: boolean;
  leftAlignment?: 'top' | 'center';
  rightAlignment?: 'top' | 'center';
  horizontalPadding?: 0;
  verticalPadding?: 'extraSmall' | 8 | 'small' | 16 | 'medium' | 24 | 'large' | 32;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  disabledStyle?: 'type1' | 'type2';
}

// ── Vertical padding mapping ──

function resolveVerticalPadding(vp?: ListRowProps['verticalPadding']): number {
  if (vp === undefined || vp === 'medium' || vp === 24) return 24;
  if (vp === 'extraSmall' || vp === 8) return 8;
  if (vp === 'small' || vp === 16) return 16;
  if (vp === 'large' || vp === 32) return 32;
  return 24;
}

// ── Arrow icon ──

function RightArrow() {
  return (
    <Txt typography="t6" color={SdsColors.grey400} style={{ marginLeft: 4 }}>
      {'>'}
    </Txt>
  );
}

// ── Main ListRow ──

const ListRowInner = forwardRef<ListRowRef, ListRowProps>(function ListRow(
  {
    left,
    contents,
    right,
    withArrow = false,
    leftAlignment = 'center',
    rightAlignment = 'center',
    horizontalPadding,
    verticalPadding,
    containerStyle,
    style,
    onPress,
    disabled = false,
    disabledStyle,
    ...a11yProps
  },
  ref,
) {
  const adaptive = useAdaptive();
  const vPad = resolveVerticalPadding(verticalPadding);
  const hPad = horizontalPadding === 0 ? 0 : 24;

  const underlayOpacity = useSharedValue(0);

  const underlayAnimStyle = useAnimatedStyle(() => ({
    opacity: underlayOpacity.value,
  }));

  const content = (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: hPad,
          paddingVertical: vPad,
        },
        disabled && disabledStyle === 'type1' && { opacity: 0.3 },
        containerStyle,
      ]}
    >
      {left != null && (
        <View
          style={[
            styles.leftSlot,
            leftAlignment === 'top' ? styles.alignTop : styles.alignCenter,
          ]}
        >
          {left}
        </View>
      )}
      {contents != null && <View style={styles.contentsSlot}>{contents}</View>}
      {(right != null || withArrow) && (
        <View
          style={[
            styles.rightSlot,
            rightAlignment === 'top' ? styles.alignTop : styles.alignCenter,
          ]}
        >
          {right}
          {withArrow && <RightArrow />}
        </View>
      )}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          underlayOpacity.value = withTiming(1, { duration: 50 });
        }}
        onPressOut={() => {
          underlayOpacity.value = withTiming(0, { duration: 200 });
        }}
        style={[styles.pressable, style]}
        {...a11yProps}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: adaptive.grey50 },
            underlayAnimStyle,
          ]}
        />
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.pressable, style]} {...a11yProps}>
      {content}
    </View>
  );
});

// ── ListRow.Texts ──

interface TextsBaseProps {
  top: ReactNode;
  topProps?: Omit<TxtProps, 'children'>;
}

interface Texts2RowBaseProps extends TextsBaseProps {
  bottom: ReactNode;
  bottomProps?: Omit<TxtProps, 'children'>;
}

interface Texts3RowBaseProps extends Texts2RowBaseProps {
  middle: ReactNode;
  middleProps?: Omit<TxtProps, 'children'>;
}

// All supported text layout types
type ListRowTextsProps =
  | ({ type: '1RowTypeA' } & TextsBaseProps)
  | ({ type: '1RowTypeB' } & TextsBaseProps)
  | ({ type: '1RowTypeC' } & TextsBaseProps)
  | ({ type: '2RowTypeA' } & Texts2RowBaseProps)
  | ({ type: '2RowTypeB' } & Texts2RowBaseProps)
  | ({ type: '2RowTypeC' } & Texts2RowBaseProps)
  | ({ type: '2RowTypeD' } & Texts2RowBaseProps)
  | ({ type: '2RowTypeE' } & Texts2RowBaseProps)
  | ({ type: '2RowTypeF' } & Texts2RowBaseProps)
  | ({ type: '3RowTypeA' } & Texts3RowBaseProps)
  | ({ type: '3RowTypeB' } & Texts3RowBaseProps)
  | ({ type: '3RowTypeC' } & Texts3RowBaseProps);

// Typography/weight for each text layout variant
const textConfig: Record<
  string,
  {
    top: { typography: TypographyKeys; fontWeight: FontWeightKeys; color?: string };
    middle?: { typography: TypographyKeys; fontWeight: FontWeightKeys; color?: string };
    bottom?: { typography: TypographyKeys; fontWeight: FontWeightKeys; color?: string };
  }
> = {
  '1RowTypeA': { top: { typography: 't5', fontWeight: 'regular' } },
  '1RowTypeB': { top: { typography: 't5', fontWeight: 'bold' } },
  '1RowTypeC': { top: { typography: 't6', fontWeight: 'regular' } },
  '2RowTypeA': {
    top: { typography: 't5', fontWeight: 'regular' },
    bottom: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
  },
  '2RowTypeB': {
    top: { typography: 't5', fontWeight: 'bold' },
    bottom: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
  },
  '2RowTypeC': {
    top: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
    bottom: { typography: 't5', fontWeight: 'regular' },
  },
  '2RowTypeD': {
    top: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
    bottom: { typography: 't5', fontWeight: 'bold' },
  },
  '2RowTypeE': {
    top: { typography: 't5', fontWeight: 'regular' },
    bottom: { typography: 't7', fontWeight: 'regular', color: SdsColors.grey500 },
  },
  '2RowTypeF': {
    top: { typography: 't5', fontWeight: 'bold' },
    bottom: { typography: 't7', fontWeight: 'regular', color: SdsColors.grey500 },
  },
  '3RowTypeA': {
    top: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
    middle: { typography: 't5', fontWeight: 'regular' },
    bottom: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
  },
  '3RowTypeB': {
    top: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
    middle: { typography: 't5', fontWeight: 'bold' },
    bottom: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
  },
  '3RowTypeC': {
    top: { typography: 't5', fontWeight: 'bold' },
    middle: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
    bottom: { typography: 't6', fontWeight: 'regular', color: SdsColors.grey600 },
  },
};

function renderTextSlot(
  content: ReactNode,
  config: { typography: TypographyKeys; fontWeight: FontWeightKeys; color?: string },
  overrideProps?: Omit<TxtProps, 'children'>,
) {
  if (content == null) return null;
  if (typeof content === 'string' || typeof content === 'number') {
    return (
      <Txt
        typography={config.typography}
        fontWeight={config.fontWeight}
        color={config.color}
        {...overrideProps}
      >
        {String(content)}
      </Txt>
    );
  }
  return <>{content}</>;
}

function ListRowTexts(props: ListRowTextsProps) {
  const config = textConfig[props.type] ?? textConfig['1RowTypeA'];

  return (
    <View style={styles.textsContainer}>
      {renderTextSlot(props.top, config.top, props.topProps)}
      {'middle' in props && config.middle && (
        <View style={{ marginTop: 2 }}>
          {renderTextSlot(
            (props as Texts3RowBaseProps).middle,
            config.middle,
            (props as Texts3RowBaseProps).middleProps,
          )}
        </View>
      )}
      {'bottom' in props && config.bottom && (
        <View style={{ marginTop: 2 }}>
          {renderTextSlot(
            (props as Texts2RowBaseProps).bottom,
            config.bottom,
            (props as Texts2RowBaseProps).bottomProps,
          )}
        </View>
      )}
    </View>
  );
}

// ── ListRow.LeftText ──

function ListRowLeftText({
  children,
  style,
  ...props
}: TxtProps & { children: string }) {
  return (
    <Txt
      typography="t6"
      fontWeight="regular"
      color={SdsColors.grey600}
      style={[{ width: 80 }, style]}
      {...props}
    >
      {children}
    </Txt>
  );
}

// ── Compound export ──

export const ListRow = Object.assign(ListRowInner, {
  Texts: ListRowTexts,
  LeftText: ListRowLeftText,
});

export type { ListRowTextsProps };

const styles = StyleSheet.create({
  pressable: {
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSlot: {
    marginRight: 16,
  },
  contentsSlot: {
    flex: 1,
  },
  rightSlot: {
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alignTop: {
    alignSelf: 'flex-start',
  },
  alignCenter: {
    alignSelf: 'center',
  },
  textsContainer: {
    flex: 1,
  },
});
