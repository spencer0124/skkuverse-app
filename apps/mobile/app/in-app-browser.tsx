/**
 * 미니앱 셸 — (서비스 이름 + 시작 URL) 두 인자로 여러 미니앱을 띄우는 공용 화면.
 * 외부 웹페이지를 react-native-webview로 렌더하고, 하단 "요약" 버튼으로 온디바이스 Kanana
 * 요약을 제공한다(추천질문/Q&A 없음 — 요약만).
 *
 * 상단 바: [홈→시작URL  서비스제목] (좌 glass 클러스터) ……… [⋯  ✕] (우 glass 클러스터)
 * 하단: [✨ 요약] 버튼 하나. 탭 → 현재 페이지 추출 → 시트에 요약 스트리밍.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SparkleIcon,
  DotsThreeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  BookmarkSimpleIcon,
  CheckIcon,
  GlobeSimpleIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { BottomSheet, Txt } from '@skkuverse/sds';
import { defaultHeaderOptions } from '@/lib/header-options';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { GlassSurface } from '@/features/in-app-browser/components/glass';
import { buildExtractScript, fetchJinaMarkdown } from '@/features/in-app-browser/extract';
import {
  parsePageMessage,
  faviconUrl,
  MIN_EXTRACT_CHARS,
  DEFAULT_BROWSER_URL,
} from '@/features/in-app-browser/protocol';
import { usePageAi, type PageContent } from '@/features/in-app-browser/ai/usePageAi';
import { PageAiSheet } from '@/features/in-app-browser/ai/PageAiSheet';

type ExtractState = 'idle' | 'pending' | 'ready' | 'empty';

/** 하단 바 아이콘 색 — 전부 검정으로 통일. */
const DOCK_ICON = SdsColors.grey900;

// iOS `unstable_headerRightItems`는 SF Symbol 또는 ImageSource만 받으므로 phosphor
// SVG를 GREY_700으로 baked한 PNG 사용(scripts/export-header-icons.mjs). tinted:false로
// navbar tintColor 재염색 회피.
const ICON_BOOKMARK = require('../assets/header-icons/bookmark-simple.png');
const ICON_MORE = require('../assets/header-icons/dots-three.png');

/**
 * 사이트 파비콘 — faviconV2 고화질 아이콘을 정사각으로 렌더. uri가 없거나(opaque origin)
 * 로딩 실패 시 중립 Globe 아이콘으로 폴백(깨진 이미지 박스 방지). uri가 바뀌면 에러 리셋.
 */
function Favicon({ uri, size }: { uri: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  if (!uri || failed) {
    return <GlobeSimpleIcon size={size} color={SdsColors.grey500} />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 4 }}
      onError={() => setFailed(true)}
    />
  );
}

/** 인증 배지 — 딥그린 원형 + 흰 체크. */
function CheckBadge({ size }: { size: number }) {
  return (
    <View
      style={[
        styles.checkBadge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <CheckIcon size={size * 0.62} color="#FFFFFF" weight="bold" />
    </View>
  );
}

export default function MiniAppScreen() {
  const params = useLocalSearchParams<{ serviceName?: string; startUrl?: string }>();
  const startUrl = params.startUrl || DEFAULT_BROWSER_URL;
  const serviceName = params.serviceName ?? '';
  const insets = useSafeAreaInsets();

  const webRef = useRef<WebView>(null);

  const [currentUrl, setCurrentUrl] = useState(startUrl);
  const [pageTitle, setPageTitle] = useState(serviceName);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  // Android BackHandler가 재구독 없이 최신 canGoBack을 읽도록 ref로 미러.
  const canGoBackRef = useRef(false);

  // 중앙 pill 탭 → 페이지 정보 시트(현재는 제목만).
  const [infoOpen, setInfoOpen] = useState(false);
  // ✨ AI 요약 시트 open 상태.
  const [aiOpen, setAiOpen] = useState(false);

  const [content, setContent] = useState<PageContent | null>(null);
  const [extractState, setExtractState] = useState<ExtractState>('idle');
  // 요약 대기 플래그 — content 도착 시 요약 실행.
  const pendingSummaryRef = useRef(false);

  const ai = usePageAi(content);

  // 현재 페이지 origin 기반 고화질 파비콘 URL(없으면 null → Globe 폴백).
  const favicon = useMemo(() => faviconUrl(currentUrl), [currentUrl]);

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
      canGoBackRef.current = nav.canGoBack;
      setCanGoForward(nav.canGoForward);
      if (nav.title) setPageTitle((prev) => (serviceName ? prev : nav.title));
    },
    [serviceName],
  );

  // ── 뒤로가기: 웹뷰 히스토리 우선, 루트에서만 화면 종료 ──
  // Android 시스템/제스처 back을 가로채 웹뷰 goBack 우선(iOS는 제스처 핸드오프로 처리 — render 참고).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true; // 처리됨 — 화면 pop 차단
      }
      return false; // 더 갈 곳 없음 → 시스템 pop = 미니앱 종료
    });
    return () => sub.remove();
  }, []);

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
    setAiOpen(true);
    triggerSummary();
  }, [triggerSummary]);

  // ── 네비 액션 ──
  const goBack = useCallback(() => webRef.current?.goBack(), []);
  const goForward = useCallback(() => webRef.current?.goForward(), []);

  return (
    <View style={styles.container}>
      {/* 네이티브 헤더 — 버스/공지와 동일 메트릭. 좌: native back(=미니앱 종료, glass 캡슐),
          제목 미표시. 우: [새로고침 | ⋯] 한 glass 캡슐(고정폭 — RN screens headerRight 왜곡 방지).
          GlassView는 fill base 위에서만 보이므로 반투명 회색 fill을 깐다(HeaderIconButton 레시피). */}
      <Stack.Screen
        options={{
          ...defaultHeaderOptions,
          headerShown: true,
          title: '',
          // iOS 엣지 스와이프 핸드오프: 웹뷰 히스토리 있으면 화면 pop 제스처 OFF →
          // WKWebView가 스와이프를 소유(웹뷰 back). 루트면 ON → 스와이프 = 미니앱 종료.
          // (한 인식기만 활성 — WebView allowsBackForwardNavigationGestures와 배타적.)
          gestureEnabled: !canGoBack,
          // 우상단 [북마크 ⋯]. iOS는 네이티브 UIBarButtonItem 2개를 sharesBackground:true로
          // 한 Liquid Glass 캡슐에 그룹핑(홈/공지 헤더와 동일 API). Android는 JSX 폴백.
          ...(Platform.OS === 'ios'
            ? {
                unstable_headerRightItems: () => [
                  {
                    type: 'button' as const,
                    label: '',
                    icon: { type: 'image' as const, source: ICON_BOOKMARK, tinted: false },
                    sharesBackground: true,
                    accessibilityLabel: '북마크',
                    // TODO: 북마크 기능 추후 구현.
                    onPress: () => {},
                  },
                  {
                    type: 'button' as const,
                    label: '',
                    icon: { type: 'image' as const, source: ICON_MORE, tinted: false },
                    sharesBackground: true,
                    accessibilityLabel: '더보기',
                    // TODO: ⋯ 더보기 메뉴 추후 구현 (ActionSheet/BottomSheet).
                    onPress: () => {},
                  },
                ],
              }
            : {
                headerRight: () => (
                  <View style={styles.rightGroup}>
                    <HeaderIconButton onPress={() => {}} accessibilityLabel="북마크">
                      <BookmarkSimpleIcon size={22} color={SdsColors.grey700} />
                    </HeaderIconButton>
                    <HeaderIconButton onPress={() => {}} accessibilityLabel="더보기">
                      <DotsThreeIcon size={22} color={SdsColors.grey700} weight="bold" />
                    </HeaderIconButton>
                  </View>
                ),
              }),
        }}
      />

      <WebView
        ref={webRef}
        source={{ uri: startUrl }}
        style={styles.webview}
        onMessage={onMessage}
        onNavigationStateChange={onNavChange}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        // iOS: 웹뷰 히스토리 있을 때만 엣지 스와이프 = 웹뷰 back/forward (Android no-op).
        // gestureEnabled={!canGoBack}와 짝 — 정확히 한 제스처 인식기만 활성.
        allowsBackForwardNavigationGestures={canGoBack}
        contentInset={{ bottom: 66 }}
      />

      {/* 하단 — 좌 [< >] / 중앙 서비스명 pill / 우 [AI]. 각 클러스터만 glass/폴백. */}
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
          {/* 앞으로 갈 히스토리가 생겼을 때만 [>] 노출 — 기본은 [<] 단독. */}
          {canGoForward && (
            <Pressable
              onPress={goForward}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel="앞으로"
            >
              <CaretRightIcon size={21} color={DOCK_ICON} />
            </Pressable>
          )}
        </GlassSurface>

        {/* 중앙 pill — [파비콘 · 서비스명 · 인증 체크]. 탭하면 페이지 정보 시트. */}
        <GlassSurface interactive style={styles.titlePill}>
          <Pressable
            onPress={() => setInfoOpen(true)}
            style={styles.titlePillBtn}
            accessibilityRole="button"
            accessibilityLabel="페이지 정보"
          >
            <Favicon uri={favicon} size={18} />
            <Text style={styles.titleText} numberOfLines={1}>
              {serviceName || pageTitle}
            </Text>
            <CheckBadge size={18} />
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
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        status={ai.status}
        summary={ai.summary}
        summaryState={ai.summaryState}
      />

      {/* 페이지 정보 시트 — [파비콘 · 서비스명 · 인증 체크] + origin. 하단 바와 동일 시각요소. */}
      <BottomSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="페이지 정보"
        snapPoints={['50%']}
      >
        <View style={styles.infoRow}>
          <Favicon uri={favicon} size={40} />
          <View style={styles.infoTextCol}>
            <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900} numberOfLines={1}>
              {serviceName || pageTitle}
            </Txt>
            <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
              {currentUrl}
            </Txt>
          </View>
          <CheckBadge size={22} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SdsColors.background },
  webview: { flex: 1 },
  // Android headerRight 폴백 — HeaderIconButton 2개를 가로 배치. iOS는 네이티브
  // unstable_headerRightItems 경로라 이 스타일을 타지 않음.
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
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
    gap: 0,
    overflow: 'hidden',
  },
  navBtn: {
    width: 36,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  // 중앙 pill — flex로 [< >]/[AI] 사이 빈 공간을 채우되 marginHorizontal로 간격 확보.
  // 통째로 탭 가능 — 서비스명만 표시, 탭하면 페이지 정보 시트.
  titlePill: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  titlePillBtn: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  titleText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: SdsColors.grey800,
  },
  // 딥그린 인증 배지(파비콘 우측). width/height/radius는 size prop으로 인라인 주입.
  checkBadge: {
    backgroundColor: SdsColors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 페이지 정보 시트 행 — [파비콘 40 · (제목/URL) · 체크 22].
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextCol: {
    flex: 1,
    gap: 2,
  },
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
