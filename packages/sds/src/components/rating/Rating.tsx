/**
 * Rating — star rating component (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <Rating value={3} onValueChange={setValue} />                    // editable
 *   <Rating value={4.5} readOnly />                                  // read-only full
 *   <Rating value={4.5} readOnly variant="compact" />                // compact "4.5 ★"
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '../txt';

// ── Star SVG ──

function StarIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
        fill={color}
      />
    </Svg>
  );
}

// ── Size maps ──

type EditableSize = 'medium' | 'large' | 'big';
type ReadOnlySize = 'tiny' | 'small' | 'medium' | 'large' | 'big';

const editableSizeMap: Record<EditableSize, number> = {
  medium: 28,
  large: 36,
  big: 44,
};

const readOnlySizeMap: Record<ReadOnlySize, number> = {
  tiny: 12,
  small: 16,
  medium: 20,
  large: 24,
  big: 28,
};

// ── Props ──

interface RatingBaseProps {
  value: number;
  /** @default 5 */
  max?: number;
  /** @default 'yellow400' mapped */
  activeColor?: string;
  style?: StyleProp<ViewStyle>;
}

export interface EditableRatingProps extends RatingBaseProps {
  readOnly?: false;
  size: EditableSize;
  onValueChange?: (value: number) => void;
  /** @default false */
  disabled?: boolean;
  gap?: number;
}

export interface ReadOnlyRatingProps extends RatingBaseProps {
  readOnly: true;
  size: ReadOnlySize;
  variant: 'full' | 'compact' | 'iconOnly';
}

export type RatingProps = EditableRatingProps | ReadOnlyRatingProps;

// ── Component ──

export default function Rating(props: RatingProps) {
  const {
    value,
    max = 5,
    activeColor = SdsColors.yellow400,
    style,
    readOnly,
  } = props;

  const inactiveColor = SdsColors.greyOpacity200;

  if (readOnly) {
    const {
      size,
      variant,
    } = props as ReadOnlyRatingProps;

    const starSize = readOnlySizeMap[size];

    if (variant === 'compact') {
      return (
        <View style={[styles.row, style]}>
          <Txt typography="t6" fontWeight="semiBold" color={SdsColors.grey900}>
            {value.toFixed(1)}
          </Txt>
          <StarIcon size={starSize} color={activeColor} />
        </View>
      );
    }

    if (variant === 'iconOnly') {
      return (
        <View style={[styles.row, { gap: 2 }, style]}>
          <StarIcon size={starSize} color={activeColor} />
          <Txt typography="t7" fontWeight="medium" color={SdsColors.grey600}>
            {value.toFixed(1)}
          </Txt>
        </View>
      );
    }

    // full variant
    return (
      <View style={[styles.row, { gap: 2 }, style]}>
        {Array.from({ length: max }, (_, i) => (
          <StarIcon
            key={i}
            size={starSize}
            color={i < Math.round(value) ? activeColor : inactiveColor}
          />
        ))}
      </View>
    );
  }

  // Editable
  const {
    size,
    onValueChange,
    disabled = false,
    gap = 4,
  } = props as EditableRatingProps;

  const starSize = editableSizeMap[size];

  const handlePress = useCallback(
    (index: number) => {
      if (disabled) return;
      onValueChange?.(index + 1);
    },
    [disabled, onValueChange],
  );

  return (
    <View style={[styles.row, { gap, opacity: disabled ? 0.4 : 1 }, style]}>
      {Array.from({ length: max }, (_, i) => (
        <Pressable key={i} onPress={() => handlePress(i)} hitSlop={4}>
          <StarIcon
            size={starSize}
            color={i < value ? activeColor : inactiveColor}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export { Rating };
