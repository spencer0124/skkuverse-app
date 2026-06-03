/**
 * 공지 상세 "SKKU AI" 질문 시트 — 전체화면, 비드래그.
 *
 * 레이아웃:
 *   ┌───────────────────────────────┐
 *   │            (✨ 로고 배지)   ✕  │  로고(글래스 배지) + ✕ 닫기
 *   │            SKKU AI            │
 *   │  [📄 공지제목]                 │  고정 chip
 *   ├───────────────────────────────┤
 *   │  (준비 중) 진행률 / 스피너       │
 *   │  (ready)  Q-A turn 스크롤        │
 *   ├───────────────────────────────┤
 *   │  ┌ glass 입력박스(2줄) ┐  [전송] │
 *   └───────────────────────────────┘
 *
 * 비드래그 전체화면: snapPoints ['100%'] + index 0, 제스처 전부 비활성,
 * handleComponent=null. 드래그로 못 닫으므로 헤더에 ✕.
 *
 * ⚠️ 한글 자모 분리 회피 (uncontrolled 입력):
 *   controlled `value`를 주면 조합(IME marked text) 중 리렌더가 native 텍스트를
 *   재조정하면서 자모가 분리된다(SDS TextField가 controlled로도 멀쩡한 건 리렌더가
 *   드물어서일 뿐 — 이 시트는 send-button enable 토글 등으로 조합 중 리렌더가 잦다).
 *   그래서 `value`를 전달하지 않고 defaultValue + ref로 다룬다(표준 IME 패턴):
 *   리렌더가 native 입력을 절대 건드리지 않으므로 조합이 깨지지 않는다.
 *   - 텍스트는 textRef에 보관, 전송 후 inputRef.clear()로 비움.
 *   - 전송 버튼 활성은 hasText(빈↔비어있지 않음 전환 시에만 setState)로 최소 리렌더.
 *
 * 키보드: BottomSheetTextInput을 안 쓰므로(역시 자모 깨짐) @gorhom 키보드 추적 대신
 *   reanimated useAnimatedKeyboard로 입력창을 키보드 위로 올린다(iOS).
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  FileTextIcon,
  ArrowUpIcon,
  StopIcon,
  XIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { useNoticeAi, type NoticeForAi } from './useNoticeAi';

const LOGO = require('../../../../assets/images/icon.png');

interface Props {
  notice: NoticeForAi;
}

export const NoticeAiSheet = forwardRef<BottomSheetModal, Props>(
  function NoticeAiSheet({ notice }, parentRef) {
    const { status, turns, isGenerating, ask, stop } = useNoticeAi(notice);
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);

    // 닫기 버튼/포커스용 내부 ref + 부모 ref 병합.
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

    const onChangeText = useCallback((t: string) => {
      textRef.current = t;
      const has = t.trim().length > 0;
      setHasText((prev) => (prev === has ? prev : has));
    }, []);

    const snapPoints = useMemo(() => ['100%'], []);

    // 키보드 높이만큼 루트 하단 패딩 → 입력창이 키보드 위로. iOS만(Android는 adjustResize).
    const keyboard = useAnimatedKeyboard();
    const keyboardStyle = useAnimatedStyle(() => ({
      paddingBottom: Platform.OS === 'ios' ? keyboard.height.value : 0,
    }));

    const ready = status.phase === 'ready';
    const canSend = ready && !isGenerating && hasText;

    // 시트가 열리고 모델이 ready면 입력창 자동 포커스 → 키보드 기본 표시.
    useEffect(() => {
      if (!sheetOpen || !ready) return;
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }, [sheetOpen, ready]);

    const handleSend = useCallback(() => {
      const text = textRef.current.trim();
      if (!text || !ready || isGenerating) return;
      void ask(text);
      inputRef.current?.clear();
      textRef.current = '';
      setHasText(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    }, [ready, isGenerating, ask]);

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
          {/* 헤더 — 로고 + 살짝 겹친 이름칸(글래스) */}
          <View style={styles.header}>
            <LogoBadge />
            <NamePill />
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
                      {tn.interrupted ? (
                        <Text style={styles.interruptedNote}>· 백그라운드로 중단됨</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* 입력 푸터 — 전체너비 입력(배경 없음) + 한 줄 아래 전송 버튼 */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              defaultValue=""
              onChangeText={onChangeText}
              placeholder={ready ? '무엇이든 물어보세요…' : 'AI 준비 중…'}
              placeholderTextColor={SdsColors.grey400}
              editable={ready && !isGenerating}
              multiline
            />
            <View style={styles.actionRow}>
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
                  <ArrowUpIcon size={20} color="#fff" weight="bold" />
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      </BottomSheetModal>
    );
  },
);

// ──────────────────────────────────────────────────────────────
// 로고 배지 — 뒤에 glass(iOS26) / 흰 원형 fallback
// ──────────────────────────────────────────────────────────────

function LogoBadge() {
  // 흰 원형 + 살짝 그림자 (Notion 로고 스타일). 그림자가 보이도록 overflow 미사용,
  // 로고 이미지 자체를 원형(borderRadius)으로 클립.
  return (
    <View style={styles.logoBadge}>
      <Image source={LOGO} style={styles.logoImg} resizeMode="cover" />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// 이름칸 — 로고와 살짝 겹친 글래스 pill (iOS26) / 흰 pill fallback
// ──────────────────────────────────────────────────────────────

function NamePill() {
  // glass 제거 — 흰 pill + 살짝 그림자. 로고가 위(앞)로 겹친다.
  return (
    <View style={styles.namePill}>
      <Text style={styles.brand}>SKKU AI</Text>
    </View>
  );
}

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

const LOGO_BADGE = 58;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey200,
    alignItems: 'center',
  },
  logoBadge: {
    width: LOGO_BADGE,
    height: LOGO_BADGE,
    borderRadius: LOGO_BADGE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // 로고가 이름칸 앞(위)으로 오도록 더 높은 zIndex
    zIndex: 2,
    // 뒤에 살짝 그림자 (overflow 미사용 — 그림자 클립 방지)
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  logoImg: {
    // 배지를 꽉 채워 흰 테두리(링) 제거. 원형 클립.
    width: LOGO_BADGE,
    height: LOGO_BADGE,
    borderRadius: LOGO_BADGE / 2,
  },
  // 로고와 살짝만 겹치게(겹침 폭 축소). 로고가 더 높은 zIndex라 로고가 앞.
  namePill: {
    marginTop: -6,
    zIndex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    zIndex: 3,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
    maxWidth: '100%',
    marginTop: 10,
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
  interruptedNote: {
    marginTop: 6,
    fontSize: 12,
    color: SdsColors.grey400,
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

  // 전체너비 입력 + 한 줄 아래 전송. 입력은 배경 없음.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SdsColors.grey200,
  },
  input: {
    width: '100%',
    minHeight: 28,
    maxHeight: 120,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 0,
    fontSize: 16,
    lineHeight: 22,
    color: SdsColors.grey900,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
