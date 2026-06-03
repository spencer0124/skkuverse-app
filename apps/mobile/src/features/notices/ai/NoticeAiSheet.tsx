/**
 * 공지 상세 "SKKU AI" 질문 시트 — 전체화면, 비드래그.
 *
 * 레이아웃:
 *   ┌───────────────────────────────┐
 *   │  ✨ SKKU AI               ✕   │  헤더 (✕로만 닫힘)
 *   │  [📄 공지제목]                 │  고정 chip
 *   ├───────────────────────────────┤
 *   │  (준비 중)  진행률 / 스피너      │
 *   │  (ready)    Q-A turn 스크롤      │
 *   ├───────────────────────────────┤
 *   │  [입력창...............] [전송] │
 *   └───────────────────────────────┘
 *
 * 비드래그 전체화면: snapPoints ['100%'] + index 0, pan/handle 제스처 전부 비활성,
 * handleComponent=null. 드래그로 못 닫으므로 헤더에 ✕ 닫기 버튼.
 *
 * ⚠️ 한글 자모 분리 회피: @gorhom의 `BottomSheetTextInput`은 내부적으로
 * react-native-gesture-handler의 TextInput을 렌더하는데, 이게 iOS에서 한글 IME
 * 조합(marked text)을 깨뜨린다. 그래서 RN 기본 `TextInput`을 사용한다(앱의 다른
 * 시트 입력이 정상인 것과 동일 이유). 대신 BottomSheetTextInput이 해주던 키보드
 * 추적이 빠지므로, reanimated `useAnimatedKeyboard`로 입력창을 키보드 위로 올린다.
 */

import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  SparkleIcon,
  FileTextIcon,
  PaperPlaneRightIcon,
  StopIcon,
  XIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { useNoticeAi, type NoticeForAi } from './useNoticeAi';

interface Props {
  notice: NoticeForAi;
}

export const NoticeAiSheet = forwardRef<BottomSheetModal, Props>(
  function NoticeAiSheet({ notice }, parentRef) {
    const { status, turns, isGenerating, ask, stop } = useNoticeAi(notice);
    const [input, setInput] = useState('');
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);

    // 닫기 버튼용 내부 ref + 부모 ref 병합 (NegativeFeedbackSheet 패턴).
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

    const snapPoints = useMemo(() => ['100%'], []);

    // 키보드 높이만큼 루트 하단 패딩 → 입력창이 키보드 위로 올라옴.
    // iOS만 적용(Android는 adjustResize가 창을 리사이즈하므로 중복 방지).
    const keyboard = useAnimatedKeyboard();
    const keyboardStyle = useAnimatedStyle(() => ({
      paddingBottom: Platform.OS === 'ios' ? keyboard.height.value : 0,
    }));

    const ready = status.phase === 'ready';
    const canSend = ready && !isGenerating && input.trim().length > 0;

    const handleSend = useCallback(() => {
      if (!canSend) return;
      void ask(input);
      setInput('');
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    }, [canSend, ask, input]);

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
      >
        <Animated.View style={[styles.root, keyboardStyle]}>
          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <SparkleIcon size={18} color={SdsColors.brand} weight="fill" />
              <Text style={styles.brand}>SKKU AI</Text>
            </View>
            <Pressable
              onPress={close}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <XIcon size={22} color={SdsColors.grey600} />
            </Pressable>
            <View style={styles.chip}>
              <FileTextIcon size={14} color={SdsColors.grey600} />
              <Text style={styles.chipLabel} numberOfLines={1}>
                {notice.title}
              </Text>
            </View>
          </View>

          {/* 본문 */}
          {!ready ? (
            <PreparingView phase={status.phase} downloadPct={status.downloadPct} />
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {turns.length === 0 ? (
                <Text style={styles.hint}>이 공지에 대해 궁금한 점을 물어보세요.</Text>
              ) : (
                turns.map((tn) => (
                  <View key={tn.id} style={styles.turn}>
                    <View style={styles.qBubble}>
                      <Text style={styles.qText}>{tn.question}</Text>
                    </View>
                    <View style={styles.aBubble}>
                      <Text style={styles.aText}>
                        {tn.answer || (isGenerating ? '…' : '')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* 입력 푸터 */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={ready ? '무엇이든 물어보세요…' : 'AI 준비 중…'}
              placeholderTextColor={SdsColors.grey400}
              editable={ready && !isGenerating}
              multiline
            />
            {isGenerating ? (
              <Pressable style={[styles.sendBtn, styles.stopBtn]} onPress={stop}>
                <StopIcon size={18} color="#fff" weight="fill" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
              >
                <PaperPlaneRightIcon size={18} color="#fff" weight="fill" />
              </Pressable>
            )}
          </View>
        </Animated.View>
      </BottomSheetModal>
    );
  },
);

// ──────────────────────────────────────────────────────────────
// 준비 중 (다운로드/로딩) 뷰
// ──────────────────────────────────────────────────────────────

function PreparingView({
  phase,
  downloadPct,
}: {
  phase: string;
  downloadPct: number;
}) {
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    // 드래그 핸들을 없앴고(handleComponent=null), 시트 top은 topInset(=safe top)에서
    // 시작한다. 헤더가 시트 최상단에 바로 붙으므로 충분한 상단 여백을 둔다.
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey200,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  brand: {
    fontSize: 16,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
    maxWidth: '100%',
  },
  chipLabel: {
    fontSize: 13,
    color: SdsColors.grey800,
    fontWeight: '500',
    flexShrink: 1,
  },

  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  hint: {
    color: SdsColors.grey500,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  turn: {
    gap: 8,
  },
  qBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: SdsColors.grey100,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  qText: {
    fontSize: 15,
    color: SdsColors.grey900,
    lineHeight: 21,
  },
  aBubble: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  aText: {
    fontSize: 15,
    color: SdsColors.grey800,
    lineHeight: 22,
  },

  preparing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  preparingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SdsColors.grey800,
  },
  preparingSub: {
    fontSize: 12,
    color: SdsColors.grey500,
  },
  preparingPct: {
    fontSize: 13,
    color: SdsColors.brand,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: SdsColors.grey200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: SdsColors.brand,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SdsColors.grey200,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: SdsColors.grey100,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: SdsColors.grey900,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SdsColors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: SdsColors.grey300,
  },
  stopBtn: {
    backgroundColor: SdsColors.grey700,
  },
});
