/**
 * ErrorPage — full-screen error state based on HTTP status code.
 *
 * Usage:
 *   <ErrorPage statusCode={404} onPressRightButton={() => goBack()} />
 *   <ErrorPage statusCode={500} title="서비스 점검 중이에요" subtitle="곧 돌아올게요." />
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import { Button } from '../button';

// ── Default messages per status code ──

const DEFAULT_MESSAGES: Record<number, { title: string; subtitle: string }> = {
  400: {
    title: '잘못된 요청이에요',
    subtitle: '입력한 내용을 다시 확인해주세요',
  },
  404: {
    title: '페이지를 찾을 수 없어요',
    subtitle: '주소를 다시 확인해주세요',
  },
  500: {
    title: '일시적인 오류가 발생했어요',
    subtitle: '잠시 후 다시 시도해주세요',
  },
};

const FALLBACK = {
  title: '오류가 발생했어요',
  subtitle: '잠시 후 다시 시도해주세요',
};

// ── Types ──

export interface ErrorPageProps {
  /** HTTP status code — determines default title/subtitle. @default 500 */
  statusCode?: number;
  /** Custom title override. */
  title?: string;
  /** Custom subtitle override. */
  subtitle?: string;
  /** Right button handler (e.g. "go back"). Shows button only when provided. */
  onPressRightButton?: () => void;
  /** Left button handler (e.g. "contact support"). Shows button only when provided. */
  onPressLeftButton?: () => void;
  /** Custom content below subtitle. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ── ErrorPage ──

export function ErrorPage({
  statusCode = 500,
  title,
  subtitle,
  onPressRightButton,
  onPressLeftButton,
  children,
  style,
}: ErrorPageProps) {
  const adaptive = useAdaptive();
  const defaults = DEFAULT_MESSAGES[statusCode] ?? FALLBACK;
  const resolvedTitle = title ?? defaults.title;
  const resolvedSubtitle = subtitle ?? defaults.subtitle;
  const hasButtons = onPressLeftButton != null || onPressRightButton != null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <CircleAlert size={64} color={adaptive.grey400} />
        <Txt
          typography="t3"
          fontWeight="bold"
          color={adaptive.grey900}
          style={styles.title}
        >
          {resolvedTitle}
        </Txt>
        <Txt typography="t5" color={adaptive.grey600} style={styles.subtitle}>
          {resolvedSubtitle}
        </Txt>
        {children}
      </View>

      {hasButtons && (
        <View style={styles.buttonRow}>
          {onPressLeftButton != null && (
            <View style={styles.button}>
              <Button
                size="large"
                display="block"
                style="weak"
                type="dark"
                onPress={onPressLeftButton}
              >
                고객센터 문의
              </Button>
            </View>
          )}
          {onPressRightButton != null && (
            <View style={styles.button}>
              <Button size="large" display="block" onPress={onPressRightButton}>
                돌아가기
              </Button>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
    width: '100%',
  },
  button: {
    flex: 1,
  },
});
