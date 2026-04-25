/**
 * BadgeNavRow — 40×40 뱃지 + 타이틀/서브타이틀 + 우측 슬롯(Switch 등) + chevron 의
 * navigation row. AccordionList의 헤더 비주얼을 재사용하지만 expand/collapse 시맨틱
 * 대신 drill-in onPress 만 가짐.
 *
 * 핵심: 우측 영역을 3-zone 으로 분할해 Switch 탭이 row onPress 와 충돌하지 않게 함.
 *   ┌──────────────────────────────────┬────────┬─────────┐
 *   │  Pressable (badge + title)       │ View   │ Press(>)│
 *   │  → onPress 발화                  │ Switch │ → onPress│
 *   │                                  │ 격리   │         │
 *   └──────────────────────────────────┴────────┴─────────┘
 *
 * Switch 영역의 `onStartShouldSetResponder={() => true}` 가 터치를 가로채
 * 부모 Pressable 로 propagate 되지 않게 함 (RN 표준 패턴).
 */
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretRightIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '../txt';

export interface BadgeNavRowProps {
  /** 40×40 뱃지에 표시할 짧은 텍스트 (1~2자) 또는 이모지. */
  badge: string;
  /** 메인 타이틀 (t5 regular). */
  title: string;
  /** 서브타이틀 (t7 regular grey500). 생략 가능. */
  subtitle?: string;
  /** 우측 영역에 들어갈 ReactNode (Switch 등). 터치는 격리됨. */
  right?: ReactNode;
  /** Drill-in 콜백 — left text 영역과 chevron 영역 둘 다에서 발화. */
  onPress: () => void;
  /** 우측 chevron 표시 여부. @default true */
  showChevron?: boolean;
  /** Disabled 시 onPress 차단 + opacity 0.4. */
  disabled?: boolean;
  /** badge 를 Tossface 폰트로 렌더링 (이모지 통일감). @default false */
  tossface?: boolean;
}

export function BadgeNavRow({
  badge,
  title,
  subtitle,
  right,
  onPress,
  showChevron = true,
  disabled = false,
  tossface = false,
}: BadgeNavRowProps) {
  const leftUnderlay = useSharedValue(0);
  const chevronUnderlay = useSharedValue(0);

  const leftUnderlayStyle = useAnimatedStyle(() => ({
    opacity: leftUnderlay.value,
  }));
  const chevronUnderlayStyle = useAnimatedStyle(() => ({
    opacity: chevronUnderlay.value,
  }));

  const handlePress = disabled ? undefined : onPress;

  return (
    <View style={disabled ? styles.disabled : undefined}>
      <View style={styles.row}>
      {/* Left zone — badge + title/subtitle. Pressable 로 drill-in 발화. */}
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          if (!disabled) leftUnderlay.value = withTiming(1, { duration: 50 });
        }}
        onPressOut={() => {
          leftUnderlay.value = withTiming(0, { duration: 200 });
        }}
        style={styles.leftZone}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: SdsColors.grey50 },
            leftUnderlayStyle,
          ]}
        />
        <View style={styles.badge}>
          {tossface ? (
            <Text style={styles.badgeEmoji}>{badge}</Text>
          ) : (
            <Txt typography="t5" fontWeight="bold" color={SdsColors.grey600}>
              {badge}
            </Txt>
          )}
        </View>
        <View style={styles.texts}>
          <Txt typography="t5" fontWeight="regular">
            {title}
          </Txt>
          {subtitle != null && (
            <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
              {subtitle}
            </Txt>
          )}
        </View>
      </Pressable>

      {/* Switch isolation zone — 터치 가로챔, parent Pressable 로 propagate 안 됨. */}
      {right != null && (
        <View
          style={styles.switchZone}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          {right}
        </View>
      )}

      {/* Chevron zone — 별도 Pressable. 같은 onPress 발화. */}
      {showChevron && (
        <Pressable
          onPress={handlePress}
          onPressIn={() => {
            if (!disabled)
              chevronUnderlay.value = withTiming(1, { duration: 50 });
          }}
          onPressOut={() => {
            chevronUnderlay.value = withTiming(0, { duration: 200 });
          }}
          hitSlop={8}
          style={styles.chevronZone}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: SdsColors.grey50 },
              chevronUnderlayStyle,
            ]}
          />
          <CaretRightIcon size={18} color={SdsColors.grey400} />
        </Pressable>
      )}
      </View>
      {/* Bottom hairline divider — matches AccordionList visual rhythm so 연속된
          BadgeNavRow 들이 시각적으로 한 묶음으로 보임. */}
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  disabled: {
    opacity: 0.4,
  },
  leftZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 22,
    lineHeight: 28,
  },
  texts: {
    flex: 1,
    marginLeft: 16,
    gap: 2,
  },
  switchZone: {
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronZone: {
    paddingLeft: 8,
    paddingRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dividerContainer: {
    paddingLeft: 76,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey100,
  },
});
