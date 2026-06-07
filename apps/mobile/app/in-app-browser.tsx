/**
 * 미니앱 셸 — (서비스 이름 + 시작 URL) 두 인자로 여러 미니앱을 띄우는 공용 화면.
 * 외부 웹페이지를 react-native-webview로 렌더한다.
 *
 * 상단 바: [홈→시작URL  서비스제목] (좌 glass 클러스터) ……… [⋯  ✕] (우 glass 클러스터)
 * 하단: [< >] / 서비스명 pill / [북마크].
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DotsThreeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  BookmarkSimpleIcon,
  BellIcon,
  GlobeSimpleIcon,
  ArrowClockwiseIcon,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { BottomSheet, Txt } from '@skkuverse/sds';
import { defaultHeaderOptions } from '@/lib/header-options';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { GlassSurface } from '@/features/in-app-browser/components/glass';
import {
  faviconUrl,
  DEFAULT_BROWSER_URL,
} from '@/features/in-app-browser/protocol';
import { MINI_APP_LOGOS } from '@/features/in-app-browser/mini-app-logos';

/** 하단 바 아이콘 색 — 전부 검정으로 통일. */
const DOCK_ICON = SdsColors.grey900;

// ── iOS 26 Safari식 하단 바 collapse 메트릭 ──
// 스크롤 다운 → 좌/우 클러스터 축소·페이드, 중앙 pill 컴팩트화. 스크롤 업 → 역재생.
const COLLAPSE_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) } as const;
const BAR_H = 46; // 클러스터/pill 공통 높이(펼침) — 정렬 기준
const COMPACT_W = 150; // collapsed 중앙 pill 폭(로고 + 잘린 이름)
const COMPACT_H = 36; // collapsed 중앙 pill 높이
const GAP = 12; // 중앙 pill ↔ 좌/우 클러스터 간격
const SIDE_PAD = 20; // 바 좌우 인셋
const DROP = 8; // 좌/우 클러스터가 접힐 때 아래로 내려가는 거리(펼치면 0으로 복귀)
const CENTER_DROP = 16; // 가운데 pill 하강 거리 — 높이가 중앙 기준으로 줄어 더 크게 줘야 체감됨
const PULL = 28; // 접힐 때 좌/우 클러스터가 가운데로 끌려가는 가로 거리(합쳐지는 느낌)

// iOS `unstable_headerRightItems`는 SF Symbol 또는 ImageSource만 받으므로 phosphor
// SVG를 GREY_700으로 baked한 PNG 사용(scripts/export-header-icons.mjs). tinted:false로
// navbar tintColor 재염색 회피.
const ICON_BELL = require('../assets/header-icons/bell.png');
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

/**
 * 서비스 로고 — MINI_APP_LOGOS에 로컬 이미지가 있으면 우선 표시, 없으면 파비콘(네트워크),
 * 둘 다 없거나 로딩 실패 시 Globe 아이콘으로 최종 폴백.
 */
function ServiceLogo({
  serviceName,
  faviconUri,
  size,
}: {
  serviceName: string;
  faviconUri: string | null;
  size: number;
}) {
  const localSource = MINI_APP_LOGOS[serviceName];
  if (localSource) {
    return (
      <Image
        source={localSource}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
      />
    );
  }
  return <Favicon uri={faviconUri} size={size} />;
}


/**
 * 더보기(⋯) 액션 시트의 한 줄 — Safari 스타일 [아이콘 · 라벨] 행. 탭하면 onPress.
 * 아이콘은 phosphor 컴포넌트를 그대로 주입(Icon 타입)해 헤더 PNG 베이킹 불필요(시트는 JSX).
 */
function MenuRow({
  icon: IconCmp,
  label,
  onPress,
}: {
  icon: PhosphorIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.menuRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconCmp size={22} color={SdsColors.grey800} />
      <Txt typography="t5" color={SdsColors.grey900}>
        {label}
      </Txt>
    </Pressable>
  );
}

export default function MiniAppScreen() {
  const params = useLocalSearchParams<{ serviceName?: string; startUrl?: string }>();
  const startUrl = params.startUrl || DEFAULT_BROWSER_URL;
  const serviceName = params.serviceName ?? '';
  const insets = useSafeAreaInsets();

  const webRef = useRef<WebView>(null);

  // ── 하단 바 collapse 상태 ──
  // collapsed: 0 = 펼침, 1 = 접힘. onScroll(JS 스레드)에서 .value를 withTiming으로 갈아끼우면
  // Reanimated가 UI 스레드로 마샬링한다(runOnUI 불필요).
  const { width: screenW } = useWindowDimensions();
  const collapsed = useSharedValue(0);
  const lastY = useRef(0);
  // 좌/우 클러스터 실측폭 — 앞으로(>) 버튼 유무로 좌 폭이 가변이라 onLayout로 측정.
  const [leftW, setLeftW] = useState(44);
  const [rightW, setRightW] = useState(58);
  // 중앙 컨테이너는 좌/우 클러스터 사이에 anchor(양쪽 GAP 균등). 펼침폭 = 그 컨테이너 폭.
  const centerInset = (w: number) => SIDE_PAD + w + GAP;
  const expandedW = Math.max(120, screenW - centerInset(leftW) - centerInset(rightW));

  // 좌/우 클러스터 — 접힐 때 가운데로 끌려가며(좌→우하단, 우→좌하단) 축소+페이드해서
  // "합쳐지는" 느낌. translate 먼저·scale 나중이라 이동량이 px 그대로 보존됨.
  const leftStyle = useAnimatedStyle(() => {
    const c = collapsed.value;
    return {
      opacity: interpolate(c, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(c, [0, 1], [0, PULL], Extrapolation.CLAMP) },
        { translateY: interpolate(c, [0, 1], [0, DROP], Extrapolation.CLAMP) },
        { scale: interpolate(c, [0, 1], [1, 0.7], Extrapolation.CLAMP) },
      ],
      pointerEvents: c > 0.5 ? 'none' : 'auto',
    };
  });
  const rightStyle = useAnimatedStyle(() => {
    const c = collapsed.value;
    return {
      opacity: interpolate(c, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(c, [0, 1], [0, -PULL], Extrapolation.CLAMP) },
        { translateY: interpolate(c, [0, 1], [0, DROP], Extrapolation.CLAMP) },
        { scale: interpolate(c, [0, 1], [1, 0.7], Extrapolation.CLAMP) },
      ],
      pointerEvents: c > 0.5 ? 'none' : 'auto',
    };
  });
  // 중앙 pill — 펼침(폭/높이) ↔ 컴팩트(폭/높이) + 접힐 때 좌우와 동일하게 DROP만큼 하강·복귀.
  const centerStyle = useAnimatedStyle(() => {
    const c = collapsed.value;
    return {
      width: interpolate(c, [0, 1], [expandedW, COMPACT_W], Extrapolation.CLAMP),
      height: interpolate(c, [0, 1], [BAR_H, COMPACT_H], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(c, [0, 1], [0, CENTER_DROP], Extrapolation.CLAMP) }],
    };
  });

  const [currentUrl, setCurrentUrl] = useState(startUrl);
  const [pageTitle, setPageTitle] = useState(serviceName);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  // Android BackHandler가 재구독 없이 최신 canGoBack을 읽도록 ref로 미러.
  const canGoBackRef = useRef(false);

  // 중앙 pill 탭 → 페이지 정보 시트(현재는 제목만).
  const [infoOpen, setInfoOpen] = useState(false);
  // 헤더 ⋯ 탭 → 더보기 액션 시트(새로고침).
  const [moreOpen, setMoreOpen] = useState(false);

  // 현재 페이지 origin 기반 고화질 파비콘 URL(없으면 null → Globe 폴백).
  const favicon = useMemo(() => faviconUrl(currentUrl), [currentUrl]);

  // 네비게이션 상태(헤더 타이틀 폴백용).
  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      setCurrentUrl(nav.url);
      setCanGoBack(nav.canGoBack);
      canGoBackRef.current = nav.canGoBack;
      setCanGoForward(nav.canGoForward);
      if (nav.title) setPageTitle((prev) => (serviceName ? prev : nav.title));
      // 새 페이지/네비게이션 시 바를 펼친 상태로 리셋(Safari 동작).
      collapsed.value = withTiming(0, COLLAPSE_TIMING);
      lastY.current = 0;
    },
    [serviceName, collapsed],
  );

  // ── 하단 바 collapse — WebView 스크롤 방향 토글 ──
  // onScroll은 JS 스레드 콜백(useAnimatedScrollHandler는 WebView에 못 붙음). 방향만 판정해
  // collapsed shared value를 withTiming으로 토글한다.
  const onScroll = useCallback(
    // contentOffset.y만 읽으므로 최소 구조 타입(전체 이벤트가 이 타입에 대입 가능 — 반공변).
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = e.nativeEvent.contentOffset.y;
      // 상단 근처(러버밴드 포함)는 항상 펼침.
      if (y < 10) {
        collapsed.value = withTiming(0, COLLAPSE_TIMING);
        lastY.current = y;
        return;
      }
      const dy = y - lastY.current;
      // 러버밴드 음수 오프셋 + 미세 지터 무시.
      if (y < 0 || Math.abs(dy) < 6) return;
      if (dy > 0) {
        collapsed.value = withTiming(1, COLLAPSE_TIMING); // 아래로 → 접힘
      } else {
        collapsed.value = withTiming(0, COLLAPSE_TIMING); // 위로 → 펼침
      }
      lastY.current = y;
    },
    [collapsed],
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

  // ── 네비 액션 ──
  const goBack = useCallback(() => webRef.current?.goBack(), []);
  const goForward = useCallback(() => webRef.current?.goForward(), []);

  // ── 더보기(⋯) 메뉴 액션 — 행 선택 시 시트 닫고 해당 동작 실행 ──
  const handleMenuRefresh = useCallback(() => {
    setMoreOpen(false);
    webRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      {/* 네이티브 헤더 — 버스/공지와 동일 메트릭. 좌: native back(=미니앱 종료, glass 캡슐),
          제목 미표시. 우: [알림 | ⋯] 한 glass 캡슐(고정폭 — RN screens headerRight 왜곡 방지).
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
          // 우상단 [알림 ⋯]. iOS는 네이티브 UIBarButtonItem 2개를 sharesBackground:true로
          // 한 Liquid Glass 캡슐에 그룹핑(홈/공지 헤더와 동일 API). Android는 JSX 폴백.
          // ⋯ 탭 → 더보기 액션 시트(새로고침). 북마크는 하단 바로 이동.
          ...(Platform.OS === 'ios'
            ? {
                unstable_headerRightItems: () => [
                  {
                    type: 'button' as const,
                    label: '',
                    icon: { type: 'image' as const, source: ICON_BELL, tinted: false },
                    sharesBackground: true,
                    accessibilityLabel: '알림',
                    // TODO: 알림 기능 추후 구현.
                    onPress: () => {},
                  },
                  {
                    type: 'button' as const,
                    label: '',
                    icon: { type: 'image' as const, source: ICON_MORE, tinted: false },
                    sharesBackground: true,
                    accessibilityLabel: '더보기',
                    onPress: () => setMoreOpen(true),
                  },
                ],
              }
            : {
                headerRight: () => (
                  <View style={styles.rightGroup}>
                    <HeaderIconButton onPress={() => {}} accessibilityLabel="알림">
                      <BellIcon size={22} color={SdsColors.grey700} />
                    </HeaderIconButton>
                    <HeaderIconButton onPress={() => setMoreOpen(true)} accessibilityLabel="더보기">
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
        onNavigationStateChange={onNavChange}
        onScroll={onScroll}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        // iOS: 웹뷰 히스토리 있을 때만 엣지 스와이프 = 웹뷰 back/forward (Android no-op).
        // gestureEnabled={!canGoBack}와 짝 — 정확히 한 제스처 인식기만 활성.
        allowsBackForwardNavigationGestures={canGoBack}
        contentInset={{ bottom: 66 }}
      />

      {/* 하단 — 좌 [< >] / 중앙 서비스명 pill / 우 [북마크]. iOS 26 Safari식 collapse:
          스크롤 다운 시 좌/우는 transform으로 축소·페이드(레이아웃 비용 0), 중앙 pill은
          단독 중앙 컨테이너 안에서 width만 애니메이트(flex 재배치 jank 회피). */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* barRow — 패딩 없는 고정 높이 행. 세 클러스터 모두 여기 안에서 top:0/bottom:0로
            수직 정렬(안전영역 패딩은 바깥 bottomBar가 전담 → 정렬 어긋남 방지). */}
        <View style={styles.barRow}>
          {/* 좌 클러스터 — absolute 좌측. onLayout으로 실측폭 → expandedW 계산. */}
          <Animated.View
            style={[styles.leftCluster, leftStyle]}
            onLayout={(ev) => setLeftW(ev.nativeEvent.layout.width)}
          >
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
          </Animated.View>

          {/* 중앙 컨테이너 — 좌/우 클러스터 사이에 anchor. 안쪽 pill 폭만 애니메이트. */}
          <View
            style={[styles.centerContainer, { left: centerInset(leftW), right: centerInset(rightW) }]}
            pointerEvents="box-none"
          >
            <Animated.View style={centerStyle}>
              <GlassSurface interactive style={styles.titlePill}>
                <Pressable
                  onPress={() => setInfoOpen(true)}
                  style={styles.titlePillBtn}
                  accessibilityRole="button"
                  accessibilityLabel="페이지 정보"
                >
                  <ServiceLogo serviceName={serviceName} faviconUri={favicon} size={18} />
                  <Text style={styles.titleText} numberOfLines={1}>
                    {serviceName || pageTitle}
                  </Text>
                </Pressable>
              </GlassSurface>
            </Animated.View>
          </View>

          {/* 우 클러스터 — absolute 우측. */}
          <Animated.View
            style={[styles.rightCluster, rightStyle]}
            onLayout={(ev) => setRightW(ev.nativeEvent.layout.width)}
          >
            <GlassSurface interactive style={styles.aiBtn}>
              <Pressable
                onPress={() => {}}
                style={styles.aiBtnInner}
                accessibilityRole="button"
                accessibilityLabel="북마크"
              >
                {/* TODO: 북마크 기능 추후 구현. */}
                <BookmarkSimpleIcon size={22} color={DOCK_ICON} />
              </Pressable>
            </GlassSurface>
          </Animated.View>
        </View>
      </View>

      {/* 페이지 정보 시트 — [로고 · 서비스명 · 인증 체크] + origin. 하단 바와 동일 시각요소. */}
      <BottomSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="페이지 정보"
        snapPoints={['50%']}
      >
        <View style={styles.infoRow}>
          <ServiceLogo serviceName={serviceName} faviconUri={favicon} size={40} />
          <View style={styles.infoTextCol}>
            <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900} numberOfLines={1}>
              {serviceName || pageTitle}
            </Txt>
            <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
              {currentUrl}
            </Txt>
          </View>
        </View>
      </BottomSheet>

      {/* 더보기(⋯) 액션 시트 — Safari 스타일 액션 목록. 콘텐츠 높이에 맞춰 hug. */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} enableDynamicSizing>
        <View style={styles.menuList}>
          <MenuRow icon={ArrowClockwiseIcon} label="새로고침" onPress={handleMenuRefresh} />
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
  // 하단 바 — 안전영역 패딩은 여기서만(세로). 좌우 인셋은 클러스터/centerInset가 담당.
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
  },
  // 패딩 없는 고정 높이 행 — 세 클러스터의 공통 정렬 컨텍스트(top:0/bottom:0 = 동일 높이).
  barRow: {
    height: BAR_H,
  },
  leftCluster: {
    position: 'absolute',
    left: SIDE_PAD,
    top: 0,
    bottom: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightCluster: {
    position: 'absolute',
    right: SIDE_PAD,
    top: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  centerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  // 중앙 pill — 폭/높이 모두 부모 Animated.View(centerStyle)가 결정. 통째로 탭 가능 —
  // 서비스명만 표시, 탭하면 페이지 정보 시트. borderRadius는 height/2 이상이라 항상 캡슐 유지.
  titlePill: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    overflow: 'hidden',
  },
  titlePillBtn: {
    flex: 1, // 부모(titlePill, 높이 100%)를 채움 — 높이 애니메이트 따라감
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
  // 페이지 정보 시트 행 — [파비콘 40 · (제목/URL)].
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextCol: {
    flex: 1,
    gap: 2,
  },
  // 더보기 액션 시트 목록 — 행 사이 구분 없는 단순 스택(Safari 메뉴 톤).
  menuList: {
    gap: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
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
