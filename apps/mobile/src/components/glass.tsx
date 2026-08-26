/**
 * Shared Liquid Glass primitives for floating controls.
 *
 * iOS 26 (`isLiquidGlassAvailable()`) renders a real `GlassView`; below it, a
 * solid white box with a shadow. The capability check runs once at module load —
 * it is a static OS/device property, not something that changes at runtime.
 *
 * Lives in `components/` rather than under a feature because two features now
 * consume it: the in-app browser's bottom bar and the event map's floating chip
 * row. Prop-driven and string-free, so neither owns it.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsColors, SdsShadows } from '@skkuverse/shared';

export const GLASS_AVAILABLE = isLiquidGlassAvailable();

/**
 * The float shadow for a control sitting over content, in the flattened shape a
 * RN style wants. Both halves are needed: `boxShadow` is the New Architecture
 * path, the legacy props cover older renderers and Android elevation.
 */
export const glassFloatShadow = {
  boxShadow: SdsShadows.glassFloat.boxShadow,
  ...SdsShadows.glassFloat.legacy,
} as const;

/** GlassView(가능 시) 또는 흰 박스+shadow 폴백으로 children을 감싼다. */
export function GlassSurface({
  style,
  children,
  interactive = false,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  interactive?: boolean;
}) {
  if (GLASS_AVAILABLE) {
    return (
      <GlassView style={style} glassEffectStyle="regular" isInteractive={interactive}>
        {children}
      </GlassView>
    );
  }
  return <View style={[style, styles.fallback]}>{children}</View>;
}

/** 원형 아이콘 버튼 (뒤로/새로고침/더보기 등). */
export function GlassIconButton({
  icon,
  onPress,
  label,
  disabled = false,
  size = 40,
}: {
  icon: ReactNode;
  onPress?: () => void;
  label: string;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <GlassSurface
      interactive
      style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.fill, disabled && styles.disabled]}
      >
        {icon}
      </Pressable>
    </GlassSurface>
  );
}

/**
 * Icon (optional) + label pill.
 *
 * `accent` and `selected` are different things and both are needed: `accent`
 * tints the label to draw the eye (a suggested question), while `selected` is a
 * filled toggle state (a chip the user has switched on). A selected chip fills
 * with brand colour rather than tinting its text, matching `FilterPill` so the
 * map and the filter sheet read as one control set.
 *
 * When selected, the glass surface is bypassed: a brand fill behind translucent
 * glass reads as a muddy tint rather than a pressed state.
 */
export function GlassChip({
  icon,
  label,
  onPress,
  accent = false,
  selected = false,
  disabled = false,
}: {
  icon?: ReactNode;
  label: string;
  onPress?: () => void;
  accent?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  const body = (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={[styles.chipInner, disabled && styles.disabled]}
    >
      {icon ? <View style={styles.chipIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? '#FFFFFF' : accent ? SdsColors.brand : SdsColors.grey800 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  if (selected) {
    return <View style={[styles.chip, styles.chipSelected]}>{body}</View>;
  }
  return (
    <GlassSurface interactive style={styles.chip}>
      {body}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  iconBtn: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: SdsColors.brand,
    ...glassFloatShadow,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipIcon: {
    marginLeft: -2,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
});
