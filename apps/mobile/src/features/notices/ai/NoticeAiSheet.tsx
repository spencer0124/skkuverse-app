/**
 * 공지 상세 "SKKU AI" 질문 바텀시트 (80%).
 *
 * 레이아웃:
 *   ┌───────────────────────────────┐
 *   │   ✨ SKKU AI        (헤더)     │
 *   │   [📄 공지제목]      (고정 chip)│
 *   ├───────────────────────────────┤
 *   │  (준비 중)  진행률 / 스피너      │
 *   │  (ready)    Q-A turn 스크롤      │
 *   ├───────────────────────────────┤
 *   │  [입력창...............] [전송] │
 *   └───────────────────────────────┘
 *
 * 입력은 모델 ready 전 비활성. 준비 상태는 시트 본문에 진행 표시(사용자 확정).
 * 단발 Q&A이지만 turns로 누적 렌더 — 멀티턴 확장 여지. (useNoticeAi)
 *
 * NegativeFeedbackSheet 패턴 미러: BottomSheetModal + keyboardBehavior="interactive".
 */

import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import {
  SparkleIcon,
  FileTextIcon,
  PaperPlaneRightIcon,
  StopIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { useNoticeAi, type NoticeForAi } from './useNoticeAi';

interface Props {
  notice: NoticeForAi;
}

export const NoticeAiSheet = forwardRef<BottomSheetModal, Props>(
  function NoticeAiSheet({ notice }, ref) {
    const { status, turns, isGenerating, ask, stop } = useNoticeAi(notice);
    const [input, setInput] = useState('');
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

    const ready = status.phase === 'ready';
    const canSend = ready && !isGenerating && input.trim().length > 0;

    const handleSend = useCallback(() => {
      if (!canSend) return;
      void ask(input);
      setInput('');
      // 새 turn이 추가되면 하단으로 스크롤
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }, [canSend, ask, input]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        android_keyboardInputMode="adjustResize"
      >
        <View style={styles.root}>
          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <SparkleIcon size={18} color={SdsColors.brand} weight="fill" />
              <Text style={styles.brand}>SKKU AI</Text>
            </View>
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
            <BottomSheetScrollView
              ref={scrollRef}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
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
            </BottomSheetScrollView>
          )}

          {/* 입력 푸터 */}
          <View style={styles.footer}>
            <BottomSheetTextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={ready ? '무엇이든 물어보세요…' : 'AI 준비 중…'}
              placeholderTextColor={SdsColors.grey400}
              editable={ready && !isGenerating}
              multiline
              onSubmitEditing={handleSend}
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
        </View>
      </BottomSheetModal>
    );
  },
);

const SNAP_POINTS = ['80%'];

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
    paddingBottom: 12,
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
