/**
 * 공지 상세 하단 "AI에게 질문하기" 진입 바.
 *
 * iOS 26+: Liquid Glass 캡슐 (expo-glass-effect GlassView — RefreshFab 패턴).
 * iOS<26 / Android: 흰 캡슐 + shadow (NoticesSearchFallbackBar 스타일).
 *
 * 공지 상세는 push된 route라 NativeTabs bottomAccessory 체인 밖 → 화면 안
 * position:'absolute' 오버레이로 직접 마운트. 준비 상태와 무관하게 항상 활성
 * (탭하면 시트가 다운로드/로딩 진행을 표시 — 사용자 확정).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SparkleIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';

const GLASS_AVAILABLE = isLiquidGlassAvailable();
const ICON_SIZE = 20;
const CAPSULE_HEIGHT = 52;
const HORIZONTAL_INSET = 16;
const BOTTOM_GAP = 10;
const LABEL = 'AI에게 질문하기';

interface Props {
  onPress: () => void;
}

export function NoticeAiBar({ onPress }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, BOTTOM_GAP);

  const inner = (
    <>
      <View style={styles.iconLeft} pointerEvents="none">
        <SparkleIcon size={ICON_SIZE} color={SdsColors.brand} weight="fill" />
      </View>
      <Text style={styles.label}>{LABEL}</Text>
    </>
  );

  if (GLASS_AVAILABLE) {
    return (
      <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
        <GlassView style={styles.glassCapsule} glassEffectStyle="regular" isInteractive>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={LABEL}
          >
            {inner}
          </Pressable>
        </GlassView>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.capsule, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={LABEL}
      >
        {inner}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: HORIZONTAL_INSET,
    right: HORIZONTAL_INSET,
  },
  // 공통 캡슐 내부 레이아웃 (아이콘 좌측 고정, 라벨 중앙)
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCapsule: {
    height: CAPSULE_HEIGHT,
    borderRadius: CAPSULE_HEIGHT / 2,
    overflow: 'hidden',
  },
  capsule: {
    height: CAPSULE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CAPSULE_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  iconLeft: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    color: SdsColors.grey800,
    fontWeight: '600',
  },
});
