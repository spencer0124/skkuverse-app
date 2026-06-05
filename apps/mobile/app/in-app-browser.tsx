/**
 * 인앱 브라우저 — 외부 웹페이지를 react-native-webview로 띄우고 온디바이스 SKKU AI
 * (요약/추천질문/Q&A)를 하단 바로 붙인다. expo-web-browser(봉인 시스템 브라우저)로는
 * JS 주입·추출·하이라이트가 불가능해서 이 화면이 그 자리를 대체한다.
 *
 * 데이터 흐름:
 *   화면(WebView 소유) — 페이지 로드 완료 시 buildExtractScript 주입 → page_extracted
 *   수신 → content 세팅(부족하면 Jina 폴백) → usePageAi(content)가 ready+content면
 *   추천질문 자동 생성(칩 바로 노출). 요약/Q&A는 칩/입력 탭 시 생성(직렬화).
 *
 * 하단 2단 바:
 *   (1) 칩 스트립 — [✨ 요약] + 추천질문 칩 N개 (가로 스크롤)
 *   (2) 크롬 행 — [<] 현재주소 [새로고침] [⋯]  (⋯ onPress는 추후 결정)
 *   버튼은 모두 glass(가능 시)/흰박스 폴백.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  SparkleIcon,
  CaretLeftIcon,
  ArrowClockwiseIcon,
  DotsThreeIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { GlassChip, GlassIconButton, GlassSurface } from '@/features/in-app-browser/components/glass';
import { buildExtractScript, fetchJinaMarkdown } from '@/features/in-app-browser/extract';
import {
  parsePageMessage,
  MIN_EXTRACT_CHARS,
  DEFAULT_BROWSER_URL,
} from '@/features/in-app-browser/protocol';
import { usePageAi, type PageContent } from '@/features/in-app-browser/ai/usePageAi';
import { PageAiSheet } from '@/features/in-app-browser/ai/PageAiSheet';

type ExtractState = 'pending' | 'ready' | 'empty';

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default function InAppBrowserScreen() {
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const initialUrl = params.url || DEFAULT_BROWSER_URL;
  const insets = useSafeAreaInsets();

  const webRef = useRef<WebView>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [pageTitle, setPageTitle] = useState(params.title ?? '');
  const [canGoBack, setCanGoBack] = useState(false);

  const [content, setContent] = useState<PageContent | null>(null);
  const [extractState, setExtractState] = useState<ExtractState>('pending');
  const extractedUrlRef = useRef<string | null>(null);
  // 추출 완료 전 탭한 요약/질문을 content 도착 시 흘려보내기 위한 대기 액션.
  const pendingRef = useRef<{ type: 'summary' } | { type: 'ask'; q: string } | null>(null);

  const ai = usePageAi(content);

  // ── 추출 ──
  const requestExtract = useCallback(() => {
    webRef.current?.injectJavaScript(buildExtractScript());
  }, []);

  const runJinaFallback = useCallback(async (url: string, title: string) => {
    const md = await fetchJinaMarkdown(url);
    if (md) {
      setContent({ title, text: md, url });
      setExtractState('ready');
    } else {
      setContent({ title, text: '', url });
      setExtractState('empty');
    }
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const msg = parsePageMessage(e.nativeEvent.data);
      if (!msg) return;
      if (msg.type === 'page_extracted') {
        const text = (msg.text ?? '').trim();
        const title = msg.title || pageTitle;
        if (text.length >= MIN_EXTRACT_CHARS) {
          setContent({ title, text, url: msg.url });
          setExtractState('ready');
        } else {
          void runJinaFallback(msg.url || currentUrl, title);
        }
      } else if (msg.type === 'page_extract_error') {
        void runJinaFallback(currentUrl, pageTitle);
      }
    },
    [pageTitle, currentUrl, runJinaFallback],
  );

  // 네비게이션 상태 추적(크롬 전용 — URL/뒤로가기/타이틀). 추출 트리거는 onLoadEnd로 분리.
  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCurrentUrl(nav.url);
    setCanGoBack(nav.canGoBack);
    if (nav.title) setPageTitle(nav.title);
  }, []);

  // 페이지 로드 완료 시 선제 추출(칩 생성용). onNavigationStateChange의 loading 플래그는
  // iOS에서 불안정해 페이지 이동 시 누락될 수 있어, 신뢰성 높은 onLoadEnd를 트리거로 쓴다.
  // 같은 URL 재추출은 가드(iframe/redirect 도배 방지).
  const onLoadEnd = useCallback(
    (e: { nativeEvent: { url?: string } }) => {
      const url = e.nativeEvent.url;
      if (!url || url === extractedUrlRef.current) return;
      extractedUrlRef.current = url;
      pendingRef.current = null; // 새 페이지 → 이전 페이지 대기 액션 폐기
      setContent(null);
      setExtractState('pending');
      requestExtract();
    },
    [requestExtract],
  );

  // content 도착 시 대기 액션 flush.
  useEffect(() => {
    const p = pendingRef.current;
    if (!p) return;
    if (extractState === 'pending') return; // 아직 대기
    pendingRef.current = null;
    if (p.type === 'summary') void ai.summarize();
    else void ai.ask(p.q);
    // ai.summarize/ask는 content empty면 내부에서 graceful 처리.
  }, [extractState, content, ai]);

  // ── 칩/입력 핸들러 ──
  // 탭 시점에 현재 페이지를 다시 추출한다 — 네비게이션 추적이 누락돼 content가 직전
  // 페이지로 고착되는 문제 방어(요약/답변이 항상 "지금 보이는 페이지"를 반영). 추출 완료
  // (onMessage → extractState ready)되면 pending-flush effect가 summarize/ask를 실행.
  const openSummary = useCallback(() => {
    sheetRef.current?.present();
    pendingRef.current = { type: 'summary' };
    setExtractState('pending');
    requestExtract();
  }, [requestExtract]);

  const openAskChip = useCallback(
    (q: string) => {
      sheetRef.current?.present();
      pendingRef.current = { type: 'ask', q };
      setExtractState('pending');
      requestExtract();
    },
    [requestExtract],
  );

  const goBack = useCallback(() => webRef.current?.goBack(), []);
  const reload = useCallback(() => webRef.current?.reload(), []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: pageTitle || '브라우저' }} />

      <WebView
        ref={webRef}
        source={{ uri: initialUrl }}
        style={styles.webview}
        onMessage={onMessage}
        onNavigationStateChange={onNavChange}
        onLoadEnd={onLoadEnd}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        // 하단 바에 콘텐츠가 가리지 않도록 여백 확보.
        contentInset={{ bottom: 112 }}
      />

      {/* 하단 2단 바 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* (1) 칩 스트립 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipStrip}
          keyboardShouldPersistTaps="handled"
        >
          <GlassChip
            icon={<SparkleIcon size={15} color={SdsColors.brand} weight="fill" />}
            label="요약"
            accent
            onPress={openSummary}
            disabled={extractState === 'pending'}
          />
          {ai.questions.map((q) => (
            <GlassChip key={q} label={q} onPress={() => openAskChip(q)} />
          ))}
        </ScrollView>

        {/* (2) 크롬 행 */}
        <View style={styles.chromeRow}>
          <GlassIconButton
            icon={<CaretLeftIcon size={20} color={canGoBack ? SdsColors.grey800 : SdsColors.grey400} />}
            onPress={goBack}
            label="뒤로"
            disabled={!canGoBack}
            size={42}
          />
          <GlassSurface style={styles.addressPill}>
            <Text style={styles.addressText} numberOfLines={1}>
              {prettyUrl(currentUrl)}
            </Text>
          </GlassSurface>
          <GlassIconButton
            icon={<ArrowClockwiseIcon size={18} color={SdsColors.grey800} />}
            onPress={reload}
            label="새로고침"
            size={42}
          />
          <GlassIconButton
            icon={<DotsThreeIcon size={20} color={SdsColors.grey800} weight="bold" />}
            label="더보기"
            size={42}
            /* onPress 추후 결정 */
          />
        </View>
      </View>

      <PageAiSheet
        ref={sheetRef}
        pageTitle={pageTitle}
        status={ai.status}
        summary={ai.summary}
        summaryState={ai.summaryState}
        turns={ai.turns}
        isGenerating={ai.isGenerating}
        onAsk={ai.ask}
        onStop={ai.stop}
        onReset={ai.reset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SdsColors.background },
  webview: { flex: 1 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  chipStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressPill: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  addressText: {
    fontSize: 13,
    color: SdsColors.grey700,
    fontWeight: '500',
  },
});
