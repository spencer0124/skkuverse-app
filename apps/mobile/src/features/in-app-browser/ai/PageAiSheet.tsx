/**
 * 인앱 브라우저 "SKKU AI" 시트 — 요약 + 일반 Q&A (전체화면, 비드래그).
 *
 * NoticeAiSheet의 시각/입력 패턴(전체화면 비드래그 시트, 한글 IME-safe uncontrolled
 * 입력, glass 헤더/입력박스)을 재사용. 차이: 상단에 "요약" 블록을 두고 그 아래로 Q&A
 * turn을 쌓는다. usePageAi는 화면이 단일 인스턴스로 보유하고 값/핸들러를 props로 내린다
 * (하단 칩 스트립이 questions를 쓰기 때문 — 시트가 훅을 들면 이중 생성).
 *
 * ⚠️ 한글 자모 분리 회피: controlled value 대신 defaultValue+ref (NoticeAiSheet 주석 참조).
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  ArrowUpIcon,
  ArrowClockwiseIcon,
  StopIcon,
  XIcon,
  CopyIcon,
  SparkleIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import type { LlmStatus } from '@/services/local-llm-manager';
import { retryPrepare } from '@/services/local-llm-manager';
import { GlassIconButton, GlassSurface } from '../components/glass';
import type { AiTurn, GenState } from './usePageAi';

const LOGO = require('../../../../assets/images/icon.png');
const BRAND_DEEP_GREEN = '#1f3d2e';

interface Props {
  pageTitle: string;
  status: LlmStatus;
  summary: string;
  summaryState: GenState;
  turns: AiTurn[];
  isGenerating: boolean;
  onAsk: (q: string) => void;
  onStop: () => void;
  onReset: () => void;
}

export const PageAiSheet = forwardRef<BottomSheetModal, Props>(function PageAiSheet(
  { pageTitle, status, summary, summaryState, turns, isGenerating, onAsk, onStop, onReset },
  parentRef,
) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

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

  // ── 입력 (uncontrolled — 자모분리 방지) ──
  const inputRef = useRef<TextInput>(null);
  const textRef = useRef('');
  const [hasText, setHasText] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const onChangeText = useCallback((t: string) => {
    textRef.current = t;
    const has = t.trim().length > 0;
    setHasText((prev) => (prev === has ? prev : has));
  }, []);

  const handleReset = useCallback(() => {
    onReset();
    inputRef.current?.clear();
    textRef.current = '';
    setHasText(false);
  }, [onReset]);

  const snapPoints = useMemo(() => ['100%'], []);

  const keyboard = useAnimatedKeyboard();
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: Platform.OS === 'ios' ? keyboard.height.value : 0,
  }));

  const ready = status.phase === 'ready';
  const canSend = ready && !isGenerating && hasText;

  useEffect(() => {
    if (!sheetOpen || !ready) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [sheetOpen, ready]);

  const handleSend = useCallback(() => {
    const text = textRef.current.trim();
    if (!text || !ready || isGenerating) return;
    onAsk(text);
    inputRef.current?.clear();
    textRef.current = '';
    setHasText(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [ready, isGenerating, onAsk]);

  const showSummary = summaryState !== 'idle';

  return (
    <BottomSheetModal
      ref={setRefs}
      index={0}
      snapPoints={snapPoints}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      handleComponent={null}
      onChange={(i) => setSheetOpen(i >= 0)}
    >
      <Animated.View style={[styles.root, keyboardStyle]}>
        {/* 헤더 */}
        <View style={styles.header}>
          <GlassIconButton
            icon={<ArrowClockwiseIcon size={18} color={SdsColors.grey700} />}
            onPress={handleReset}
            label="새 대화"
            size={36}
          />
          <View style={styles.headerCenter} pointerEvents="none">
            <View style={styles.logoBadge}>
              <Image source={LOGO} style={styles.logoImg} resizeMode="cover" />
            </View>
            <View style={styles.namePill}>
              <Text style={styles.brand}>SKKU AI</Text>
            </View>
          </View>
          <GlassIconButton
            icon={<XIcon size={18} color={SdsColors.grey700} />}
            onPress={close}
            label="닫기"
            size={36}
          />
        </View>

        {/* 본문 */}
        {!ready ? (
          <PreparingView
            phase={status.phase}
            downloadPct={status.downloadPct}
            onRetry={() => void retryPrepare()}
          />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {showSummary ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryHead}>
                  <SparkleIcon size={15} color={SdsColors.brand} weight="fill" />
                  <Text style={styles.summaryLabel}>요약</Text>
                </View>
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
                {summary && summaryState === 'done' ? <AnswerActions answer={summary} /> : null}
              </View>
            ) : null}

            {turns.map((tn) => (
              <View key={tn.id} style={styles.turn}>
                <View style={styles.qBubble}>
                  <Text style={styles.qText}>{tn.question}</Text>
                </View>
                <View style={styles.aBubble}>
                  {tn.answer ? (
                    <Text style={styles.aText} selectable>
                      {tn.answer}
                    </Text>
                  ) : isGenerating ? (
                    <ThinkingShimmer />
                  ) : null}
                  {tn.interrupted ? (
                    <Text style={styles.interruptedNote}>· 백그라운드로 중단됨</Text>
                  ) : null}
                  {tn.answer && !isGenerating ? <AnswerActions answer={tn.answer} /> : null}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 입력 푸터 */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <GlassSurface interactive style={styles.inputBox}>
            <View style={styles.boxChip}>
              <SparkleIcon size={13} color={SdsColors.grey600} />
              <Text style={styles.chipLabel} numberOfLines={1}>
                {pageTitle || '현재 페이지'}
              </Text>
            </View>
            <TextInput
              ref={inputRef}
              style={[styles.input, { minHeight: inputFocused && !isGenerating ? 46 : 24 }]}
              defaultValue=""
              onChangeText={onChangeText}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={ready ? '이 페이지에 대해 물어보세요' : 'AI 준비 중…'}
              placeholderTextColor={SdsColors.grey400}
              editable={ready && !isGenerating}
              multiline
            />
            <View style={styles.actionRow}>
              {isGenerating ? (
                <Pressable style={[styles.sendBtn, styles.stopBtn]} onPress={onStop}>
                  <StopIcon size={15} color="#fff" weight="fill" />
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!canSend}
                >
                  <ArrowUpIcon size={17} color="#fff" weight="bold" />
                </Pressable>
              )}
            </View>
          </GlassSurface>
        </View>
      </Animated.View>
    </BottomSheetModal>
  );
});

function ThinkingShimmer() {
  const op = useSharedValue(0.35);
  useEffect(() => {
    op.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [op]);
  const animStyle = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.Text style={[styles.thinking, animStyle]}>생각 중…</Animated.Text>;
}

function AnswerActions({ answer }: { answer: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void Clipboard.setStringAsync(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [answer]);
  return (
    <View style={styles.answerActions}>
      <Pressable onPress={onCopy} hitSlop={6} style={styles.answerActionBtn} accessibilityLabel="복사">
        <CopyIcon size={16} color={copied ? SdsColors.brand : SdsColors.grey500} />
      </Pressable>
    </View>
  );
}

function PreparingView({
  phase,
  downloadPct,
  onRetry,
}: {
  phase: string;
  downloadPct: number;
  onRetry: () => void;
}) {
  if (phase === 'error') {
    return (
      <View style={styles.preparing}>
        <Text style={styles.preparingTitle}>AI를 준비하지 못했어요</Text>
        <Text style={styles.preparingSub}>잠시 후 다시 시도해 주세요.</Text>
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

const LOGO_BADGE = 52;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey200,
  },
  headerCenter: { alignItems: 'center' },
  logoBadge: {
    width: LOGO_BADGE,
    height: LOGO_BADGE,
    borderRadius: LOGO_BADGE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  logoImg: { width: LOGO_BADGE, height: LOGO_BADGE, borderRadius: LOGO_BADGE / 2 },
  namePill: {
    marginTop: -6,
    zIndex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  brand: { fontSize: 15, fontWeight: '700', color: SdsColors.grey900 },

  scroll: { flex: 1 },
  body: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },

  summaryCard: {
    backgroundColor: SdsColors.grey50,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: SdsColors.brand },
  summaryText: { fontSize: 15, color: SdsColors.grey800, lineHeight: 23 },
  errorText: { fontSize: 14, color: SdsColors.grey500 },

  turn: { gap: 12 },
  qBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: SdsColors.grey100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  qText: { fontSize: 15, color: SdsColors.grey900, lineHeight: 21 },
  aBubble: { alignSelf: 'flex-start', maxWidth: '95%' },
  aText: { fontSize: 15, color: SdsColors.grey800, lineHeight: 22 },
  interruptedNote: { marginTop: 6, fontSize: 12, color: SdsColors.grey400 },
  thinking: { fontSize: 15, color: SdsColors.grey500, fontWeight: '500' },
  answerActions: { flexDirection: 'row', gap: 4, marginTop: 8 },
  answerActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  footer: { paddingHorizontal: 16, paddingTop: 8 },
  inputBox: { borderRadius: 20, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, overflow: 'hidden' },
  boxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
    maxWidth: '100%',
    marginBottom: 8,
  },
  chipLabel: { fontSize: 13, color: SdsColors.grey800, fontWeight: '500', flexShrink: 1 },
  input: {
    width: '100%',
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    fontSize: 16,
    lineHeight: 22,
    color: SdsColors.grey900,
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_DEEP_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: SdsColors.grey300 },
  stopBtn: { backgroundColor: SdsColors.grey700 },
});
