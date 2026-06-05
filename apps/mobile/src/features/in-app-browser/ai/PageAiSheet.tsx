/**
 * 미니앱 "SKKU AI" 요약 시트 — 요약만 표시(입력·Q&A 없음).
 *
 * 구성:
 *   ┌──────────────────────────────────┐
 *   │ (글래스 로고) SKKU AI 요약     ⓘ  │  한 줄 — 로고+제목 좌, info 우
 *   │  요약 내용(스트리밍)…              │
 *   │            [복사]  [닫기]          │  하단 버튼
 *   └──────────────────────────────────┘
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { InfoIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import type { LlmStatus } from '@/services/local-llm-manager';
import { retryPrepare } from '@/services/local-llm-manager';
import { GLASS_AVAILABLE } from '../components/glass';
import type { GenState } from './usePageAi';

const LOGO = require('../../../../assets/images/icon.png');
const BRAND_DEEP_GREEN = '#1f3d2e';

interface Props {
  status: LlmStatus;
  summary: string;
  summaryState: GenState;
}

export const PageAiSheet = forwardRef<BottomSheetModal, Props>(function PageAiSheet(
  { status, summary, summaryState },
  parentRef,
) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const setRefs = useCallback(
    (node: BottomSheetModal | null) => {
      sheetRef.current = node;
      if (typeof parentRef === 'function') parentRef(node);
      else if (parentRef) parentRef.current = node;
    },
    [parentRef],
  );
  const close = useCallback(() => sheetRef.current?.dismiss(), []);
  const snapPoints = useMemo(() => ['68%'], []);
  const ready = status.phase === 'ready';

  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (!summary) return;
    void Clipboard.setStringAsync(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [summary]);

  const onInfo = useCallback(() => {
    Alert.alert(
      'SKKU AI 요약',
      'AI가 페이지 내용을 바탕으로 기기에서 자동 생성한 요약이에요. 부정확할 수 있으니 중요한 내용은 원문을 확인해 주세요.',
    );
  }, []);

  return (
    <BottomSheetModal
      ref={setRefs}
      index={0}
      snapPoints={snapPoints}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
    >
      <View style={styles.root}>
        {/* 제목 한 줄 */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <GlassLogo />
            <Text style={styles.titleText}>SKKU AI 요약</Text>
          </View>
          <Pressable onPress={onInfo} hitSlop={10} accessibilityRole="button" accessibilityLabel="안내">
            <InfoIcon size={20} color={SdsColors.grey400} />
          </Pressable>
        </View>

        {/* 내용 */}
        {!ready ? (
          <PreparingView
            phase={status.phase}
            downloadPct={status.downloadPct}
            error={status.error}
            onRetry={() => void retryPrepare()}
          />
        ) : (
          <BottomSheetScrollView contentContainerStyle={styles.body}>
            {summary ? (
              <Text style={styles.summaryText} selectable>
                {summary}
              </Text>
            ) : summaryState === 'error' ? (
              <Text style={styles.errorText}>
                이 페이지에서 요약할 내용을 찾지 못했어요. 페이지가 다 로딩됐는지 확인해 주세요.
              </Text>
            ) : (
              <ThinkingShimmer />
            )}
          </BottomSheetScrollView>
        )}

        {/* 하단 버튼 — 복사 / 닫기 */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.footerBtn, styles.copyBtn, !summary && styles.btnDisabled]}
            onPress={onCopy}
            disabled={!summary}
          >
            <Text style={styles.copyBtnText}>{copied ? '복사됨' : '복사'}</Text>
          </Pressable>
          <Pressable style={[styles.footerBtn, styles.closeBtn]} onPress={close}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  );
});

// 리퀴드글래스 버전 로고 — glass 가능 시 GlassView 원형, 아니면 흰 원형 폴백.
function GlassLogo() {
  if (GLASS_AVAILABLE) {
    return (
      <GlassView style={styles.logoBadge} glassEffectStyle="regular">
        <Image source={LOGO} style={styles.logoImg} resizeMode="cover" />
      </GlassView>
    );
  }
  return (
    <View style={[styles.logoBadge, styles.logoBadgeFallback]}>
      <Image source={LOGO} style={styles.logoImg} resizeMode="cover" />
    </View>
  );
}

function ThinkingShimmer() {
  const op = useSharedValue(0.35);
  useEffect(() => {
    op.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [op]);
  const animStyle = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.Text style={[styles.thinking, animStyle]}>요약하는 중…</Animated.Text>;
}

function PreparingView({
  phase,
  downloadPct,
  error,
  onRetry,
}: {
  phase: string;
  downloadPct: number;
  error?: string;
  onRetry: () => void;
}) {
  if (phase === 'error') {
    return (
      <View style={styles.preparing}>
        <Text style={styles.preparingTitle}>AI를 준비하지 못했어요</Text>
        <Text style={styles.preparingSub}>잠시 후 다시 시도해 주세요.</Text>
        {error ? (
          <Text style={styles.errorDetail} selectable>
            {error}
          </Text>
        ) : null}
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
  const downloading = phase === 'downloading';
  return (
    <View style={styles.preparing}>
      {downloading ? (
        <>
          <Text style={styles.preparingTitle}>AI 모델 다운로드 중…</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${clamp(downloadPct)}%` }]} />
          </View>
          <Text style={styles.preparingPct}>{clamp(downloadPct)}%</Text>
          <Text style={styles.preparingSub}>최초 1회만 받아요 (약 1.5GB).</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={SdsColors.brand} />
          <Text style={styles.preparingTitle}>AI 준비 중…</Text>
        </>
      )}
    </View>
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const LOGO_BADGE = 26;

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  logoBadge: {
    width: LOGO_BADGE,
    height: LOGO_BADGE,
    borderRadius: LOGO_BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoBadgeFallback: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  logoImg: { width: LOGO_BADGE, height: LOGO_BADGE, borderRadius: LOGO_BADGE / 2 },
  titleText: { fontSize: 17, fontWeight: '700', color: SdsColors.grey900 },

  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  summaryText: { fontSize: 15, color: SdsColors.grey800, lineHeight: 24 },
  errorText: { fontSize: 14, color: SdsColors.grey500, lineHeight: 21 },
  thinking: { fontSize: 15, color: SdsColors.grey500, fontWeight: '500' },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SdsColors.grey200,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  copyBtn: { backgroundColor: SdsColors.grey100 },
  copyBtnText: { fontSize: 15, fontWeight: '700', color: SdsColors.grey800 },
  closeBtn: { backgroundColor: BRAND_DEEP_GREEN },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  preparing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  preparingTitle: { fontSize: 15, fontWeight: '600', color: SdsColors.grey800 },
  preparingSub: { fontSize: 12, color: SdsColors.grey500 },
  preparingPct: { fontSize: 13, color: SdsColors.brand, fontWeight: '600' },
  errorDetail: {
    fontSize: 11,
    color: SdsColors.grey400,
    fontFamily: 'Menlo',
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: BRAND_DEEP_GREEN,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: SdsColors.grey200,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: SdsColors.brand },
});
