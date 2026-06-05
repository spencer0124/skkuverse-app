/**
 * 미니앱 셸 — (서비스 이름 + 시작 URL) 두 인자로 여러 미니앱을 띄우는 공용 화면.
 * 외부 웹페이지를 react-native-webview로 렌더하고, 하단 "요약" 버튼으로 온디바이스 Kanana
 * 요약을 제공한다(추천질문/Q&A 없음 — 요약만).
 *
 * 상단 바: [홈→시작URL  서비스제목] (좌 glass 클러스터) ……… [⋯  ✕] (우 glass 클러스터)
 * 하단: [✨ 요약] 버튼 하나. 탭 → 현재 페이지 추출 → 시트에 요약 스트리밍.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  SparkleIcon,
  DotsThreeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowClockwiseIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { GlassSurface } from '@/features/in-app-browser/components/glass';
import { buildExtractScript, fetchJinaMarkdown } from '@/features/in-app-browser/extract';
import {
  parsePageMessage,
  MIN_EXTRACT_CHARS,
  DEFAULT_BROWSER_URL,
} from '@/features/in-app-browser/protocol';
import { usePageAi, type PageContent } from '@/features/in-app-browser/ai/usePageAi';
import { PageAiSheet } from '@/features/in-app-browser/ai/PageAiSheet';

type ExtractState = 'idle' | 'pending' | 'ready' | 'empty';

/** 하단 바 아이콘 색 — 전부 검정으로 통일. */
const DOCK_ICON = SdsColors.grey900;

export default function MiniAppScreen() {
  const params = useLocalSearchParams<{ serviceName?: string; startUrl?: string }>();
  const startUrl = params.startUrl || DEFAULT_BROWSER_URL;
  const serviceName = params.serviceName ?? '';
  const insets = useSafeAreaInsets();

  const webRef = useRef<WebView>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const [currentUrl, setCurrentUrl] = useState(startUrl);
  const [pageTitle, setPageTitle] = useState(serviceName);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const [content, setContent] = useState<PageContent | null>(null);
  const [extractState, setExtractState] = useState<ExtractState>('idle');
  // 요약 대기 플래그 — content 도착 시 요약 실행.
  const pendingSummaryRef = useRef(false);

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

  // 네비게이션 상태(헤더 타이틀 폴백 + Jina 폴백용 URL). 추출은 요약 탭 시 on-demand.
  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      setCurrentUrl(nav.url);
      setCanGoBack(nav.canGoBack);
      setCanGoForward(nav.canGoForward);
      if (nav.title) setPageTitle((prev) => (serviceName ? prev : nav.title));
    },
    [serviceName],
  );

  // content 도착(추출 완료) 시 대기 중이던 요약 실행.
  useEffect(() => {
    if (!pendingSummaryRef.current) return;
    if (extractState === 'pending') return; // 아직 추출 중
    pendingSummaryRef.current = false;
    void ai.summarize(); // content empty면 훅 내부에서 graceful 처리
  }, [extractState, content, ai]);

  // ── 요약: 탭 시점에 현재 페이지를 재추출 → 시트에 요약 ──
  const triggerSummary = useCallback(() => {
    pendingSummaryRef.current = true;
    setExtractState('pending');
    requestExtract();
  }, [requestExtract]);

  const openSummary = useCallback(() => {
    sheetRef.current?.present();
    triggerSummary();
  }, [triggerSummary]);

  // ── 상단 바 액션 ──
  const close = useCallback(() => router.back(), []);

  // ── 하단 바 액션 ──
  const goBack = useCallback(() => webRef.current?.goBack(), []);
  const goForward = useCallback(() => webRef.current?.goForward(), []);
  const reload = useCallback(() => webRef.current?.reload(), []);

  const headerTitle = serviceName || pageTitle || '브라우저';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 상단 바 — 좌클러스터 [< 제목 홈] / 우클러스터 [새로고침 ⋯]. glass(가능 시)/폴백. */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <GlassSurface interactive style={styles.topClusterLeft}>
          <Pressable
            onPress={close}
            hitSlop={6}
            style={styles.topIconBtn}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
          >
            <CaretLeftIcon size={20} color={SdsColors.grey800} />
          </Pressable>
          <Text style={styles.serviceTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
        </GlassSurface>

        <GlassSurface interactive style={styles.topClusterRight}>
          <Pressable
            onPress={reload}
            hitSlop={6}
            style={styles.topIconBtn}
            accessibilityRole="button"
            accessibilityLabel="새로고침"
          >
            <ArrowClockwiseIcon size={20} color={SdsColors.grey800} />
          </Pressable>
          <Pressable
            onPress={undefined /* ⋯ onPress 추후 결정 */}
            hitSlop={6}
            style={styles.topIconBtn}
            accessibilityRole="button"
            accessibilityLabel="더보기"
          >
            <DotsThreeIcon size={22} color={SdsColors.grey800} weight="bold" />
          </Pressable>
        </GlassSurface>
      </View>

      <WebView
        ref={webRef}
        source={{ uri: startUrl }}
        style={styles.webview}
        onMessage={onMessage}
        onNavigationStateChange={onNavChange}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        contentInset={{ bottom: 66 }}
      />

      {/* 하단 — 좌클러스터 [< >] / 우클러스터 [AI]. 각 클러스터만 glass/폴백. */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <GlassSurface interactive style={styles.bottomNav}>
          <Pressable
            onPress={goBack}
            disabled={!canGoBack}
            style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
          >
            <CaretLeftIcon size={21} color={DOCK_ICON} />
          </Pressable>
          <Pressable
            onPress={goForward}
            disabled={!canGoForward}
            style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="앞으로"
          >
            <CaretRightIcon size={21} color={DOCK_ICON} />
          </Pressable>
        </GlassSurface>

        <GlassSurface interactive style={styles.aiBtn}>
          <Pressable
            onPress={openSummary}
            style={styles.aiBtnInner}
            accessibilityRole="button"
            accessibilityLabel="AI 요약"
          >
            <SparkleIcon size={22} color={DOCK_ICON} weight="fill" />
          </Pressable>
        </GlassSurface>
      </View>

      <PageAiSheet
        ref={sheetRef}
        status={ai.status}
        summary={ai.summary}
        summaryState={ai.summaryState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SdsColors.background },
  webview: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  topClusterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 2,
    overflow: 'hidden',
    flexShrink: 1,
  },
  topClusterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  topIconBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: SdsColors.grey900,
    flexShrink: 1,
    marginHorizontal: 4,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 4,
    gap: 6,
    overflow: 'hidden',
  },
  navBtn: {
    width: 42,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  aiBtn: {
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
  },
  aiBtnInner: {
    height: 46,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
