/**
 * 인앱 브라우저 하단 바 공용 글래스 프리미티브.
 *
 * iOS 26 Liquid Glass(`isLiquidGlassAvailable()`)면 GlassView, 아니면 흰 박스 + shadow
 * 폴백 — NoticeAiSheet의 HeaderGlassButton/InputBox 패턴을 재사용 가능한 형태로 추출.
 * 능력 체크는 모듈 로드 1회(정적 OS/기기 속성).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsColors } from '@skkuverse/shared';

export const GLASS_AVAILABLE = isLiquidGlassAvailable();

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

/** 아이콘(옵션) + 라벨 pill 칩 (요약/추천질문). accent면 브랜드 컬러 강조. */
export function GlassChip({
  icon,
  label,
  onPress,
  accent = false,
  disabled = false,
}: {
  icon?: ReactNode;
  label: string;
  onPress?: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <GlassSurface interactive style={styles.chip}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.chipInner, disabled && styles.disabled]}
      >
        {icon ? <View style={styles.chipIcon}>{icon}</View> : null}
        <Text
          style={[styles.chipLabel, { color: accent ? SdsColors.brand : SdsColors.grey800 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
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
