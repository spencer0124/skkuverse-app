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
  Linking,
  Platform,
  Pressable,
  Share,
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
  SealCheckIcon,
  LinkIcon,
  XIcon,
  ShareNetworkIcon,
  GearSixIcon,
  HeadsetIcon,
  HouseIcon,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';
import {
  SdsColors,
  getWebOrigin,
  useMiniAppDetail,
  useMiniAppIndex,
} from '@skkuverse/shared';
import { GlassSurface, Sheet, Txt } from '@skkuverse/sds';
import { defaultHeaderOptions } from '@/lib/header-options';
import { normalizeWebUrl } from '@/lib/web-url';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { faviconUrl } from '@/features/mini-app/protocol';

/** 하단 바 아이콘 색 — 전부 검정으로 통일. */
const DOCK_ICON = SdsColors.grey900;
/** 인증 배지 색 — 스꾸버스 딥그린 브랜드 컬러. */
const VERIFIED_COLOR = SdsColors.brand;

/** 표시용 URL — 프로토콜/끝 슬래시 제거. */
const displayUrl = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/+$/, '');

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
 * 서비스 로고 — 레지스트리 로고(서버 호스팅 URL)를 우선 표시, 없으면 파비콘(네트워크),
 * 둘 다 없거나 로딩 실패 시 Globe 아이콘으로 최종 폴백.
 *
 * 번들 require() 로고는 제거됨 — 레지스트리가 서버 소유가 되면서 로고도
 * `logo.uri`(skkuverse.com/miniapps/<id>.png)로 내려온다. 미니앱 추가에 앱
 * 릴리스가 필요 없다는 게 이 전환의 목적이므로, 로고만 번들로 남기면 그 목적이 깨진다.
 */
function ServiceLogo({
  logoUri,
  faviconUri,
  size,
}: {
  logoUri?: string;
  faviconUri: string | null;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoUri]);

  if (logoUri && !failed) {
    return (
      <Image
        source={{ uri: logoUri }}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
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

/**
 * 정보 시트 관련 링크 한 줄 — 통일된 체인 링크 아이콘 + [라벨 / URL].
 * label 없으면 URL이 곧 제목(한 줄), 있으면 굵은 라벨 위·회색 URL 아래(두 줄).
 */
function LinkRow({ label, url, onPress }: { label?: string; url: string; onPress: () => void }) {
  const display = displayUrl(url);
  return (
    <Pressable
      onPress={onPress}
      style={styles.linkRow}
      accessibilityRole="link"
      accessibilityLabel={label ?? display}
    >
      <LinkIcon size={20} color={SdsColors.grey900} />
      <View style={styles.linkTextCol}>
        {label ? (
          <>
            <Txt typography="t6" fontWeight="bold" color={SdsColors.grey900} numberOfLines={1}>
              {label}
            </Txt>
            <Txt typography="t7" color={SdsColors.grey400} numberOfLines={1}>
              {display}
            </Txt>
          </>
        ) : (
          <Txt typography="t6" fontWeight="bold" color={SdsColors.grey900} numberOfLines={1}>
            {display}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

export default function MiniAppScreen() {
  // slug만 라우트를 건넌다 — 이름·시작 URL·로고는 전부 레지스트리(서버)에서 해석.
  // 예전처럼 serviceName/startUrl을 params로 받으면 호출부가 레지스트리와 어긋난
  // 셸을 그릴 수 있다.
  const params = useLocalSearchParams<{ id?: string }>();
  const miniAppId = params.id;
  const insets = useSafeAreaInsets();

  // 레지스트리 상세 — 시작 URL·인증 배지·소개·관련 링크·공지 배너의 단일 출처.
  const { data: detail } = useMiniAppDetail(miniAppId);
  // 인덱스 엔트리 — 표시 이름과 로고. 홈 그리드가 이미 캐시해둔 쿼리를 재사용.
  const { data: index } = useMiniAppIndex();
  const entry = useMemo(
    () => (miniAppId ? index?.find((e) => e.id === miniAppId) : undefined),
    [index, miniAppId],
  );

  // http→https 업그레이드 필수 — iOS ATS가 cleartext http를 차단한다(NSURLErrorDomain
  // -1022). 레지스트리에는 여전히 http startUrl이 있고(hssc/nsc/skkuw), 예전에는
  // openMiniApp()이 push 직전에 정규화했다. URL 해석이 화면으로 내려오면서 그
  // 단계가 사라졌었다. 서버 데이터를 고치는 것과 별개로 여기서 방어한다 —
  // 레지스트리는 서버 소유라 언제든 http가 다시 들어올 수 있다.
  const startUrl = detail?.startUrl ? normalizeWebUrl(detail.startUrl).url : '';
  const serviceName = entry?.name ?? '';
  const logoUri = entry?.logo?.uri;
  // 공유/홈추가 링크가 가리키는 웹 도메인 — 서버 설정(GET /app/config). 아직 못
  // 받았으면 null이고, 해당 메뉴는 degrade하거나 숨는다.
  const webOrigin = getWebOrigin();

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

  // startUrl은 레지스트리 fetch 이후에야 정해지므로 초기값은 빈 문자열.
  // `currentUrl || startUrl`로 읽어 상세 도착 시점에 자연히 채워지게 한다
  // (effect로 setState하면 첫 페인트가 한 프레임 늦는다).
  const [navigatedUrl, setNavigatedUrl] = useState('');
  const currentUrl = navigatedUrl || startUrl;
  const [pageTitle, setPageTitle] = useState(serviceName);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  // Android BackHandler가 재구독 없이 최신 canGoBack을 읽도록 ref로 미러.
  const canGoBackRef = useRef(false);

  // 상단 공지 배너 노출 여부 — 탭하면 닫힘.
  const [noticeVisible, setNoticeVisible] = useState(true);
  // 중앙 pill 탭 → 페이지 정보 시트(현재는 제목만).
  const [infoOpen, setInfoOpen] = useState(false);
  // 헤더 ⋯ 탭 → 더보기 액션 시트(새로고침).
  const [moreOpen, setMoreOpen] = useState(false);

  // 현재 페이지 origin 기반 고화질 파비콘 URL(없으면 null → Globe 폴백).
  const favicon = useMemo(() => faviconUrl(currentUrl), [currentUrl]);

  // 네비게이션 상태(헤더 타이틀 폴백용).
  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      setNavigatedUrl(nav.url);
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

  // 정보 시트 링크 — 시트 닫고 현재 웹뷰를 해당 URL로 이동(loadUrl API 없어 location 주입).
  const openLink = useCallback((url: string) => {
    setInfoOpen(false);
    webRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(url)};true;`);
  }, []);

  // ── 더보기(⋯) 메뉴 액션 — 행 선택 시 시트 닫고 해당 동작 실행 ──
  const handleMenuRefresh = useCallback(() => {
    setMoreOpen(false);
    webRef.current?.reload();
  }, []);

  // 공유하기 — "미니앱 진입 링크"(universal link)를 OS 공유 시트로. 받은 사람이 앱이
  // 있으면 그 미니앱이 바로 열림(Toss minion 링크 방식). webOrigin은 서버 설정에서
  // 오므로, 아직 못 받았으면 현재 페이지 URL로 degrade — 하드코딩 폴백을 두면
  // 서버가 SSOT라는 전제가 깨진다.
  const handleShare = useCallback(async () => {
    setMoreOpen(false);
    const link =
      webOrigin && miniAppId ? `${webOrigin}/p/m/${miniAppId}` : currentUrl;
    if (!link) return;
    try {
      // iOS는 message+url을 별개 항목으로 취급해 URL이 두 번 노출됨 → 플랫폼당 하나만.
      // iOS: url(링크 프리뷰), Android: message(url prop 무시되므로 텍스트로).
      await Share.share(Platform.OS === 'ios' ? { url: link } : { message: link });
    } catch {
      // 사용자 취소 등 — 무시.
    }
  }, [webOrigin, miniAppId, currentUrl]);

  // 홈 화면에 추가 — Toss식 제네릭 런처 페이지를 외부 Safari로 연다(인앱 WebView/SFSafariVC는
  // A2HS 불가). 페이지가 아이콘/이름을 쿼리로 받아 세팅하고, standalone 실행 시 skkuverse://m/<id>로
  // 리다이렉트. 아이콘은 레지스트리 로고를 그대로 재사용 — 서버가 이미 절대 URL로 내려준다.
  const handleAddToHome = useCallback(() => {
    setMoreOpen(false);
    if (!miniAppId || !webOrigin) return;
    const icon = logoUri ?? `${webOrigin}/miniapps/${miniAppId}.png`;
    const url =
      `${webOrigin}/m/shortcut?id=${encodeURIComponent(miniAppId)}` +
      `&title=${encodeURIComponent(serviceName || pageTitle)}` +
      `&iconUrl=${encodeURIComponent(icon)}`;
    void Linking.openURL(url).catch(() => {});
  }, [miniAppId, webOrigin, logoUri, serviceName, pageTitle]);

  // TODO: 설정/고객센터 화면 연결. 현재는 시트만 닫는 더미.
  const handleSettings = useCallback(() => setMoreOpen(false), []);
  const handleSupport = useCallback(() => setMoreOpen(false), []);

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
                    accessibilityLabel: '공지',
                    // 공지 배너 다시 띄우기(X로 닫았을 때 복구).
                    onPress: () => setNoticeVisible(true),
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
                    <HeaderIconButton onPress={() => setNoticeVisible(true)} accessibilityLabel="공지">
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

      {/* startUrl은 레지스트리에서 온다 — 도착 전에 마운트하면 about:blank를 한 번
          로드하고 히스토리에 남아 뒤로가기가 빈 페이지로 간다. 그래서 URL이 생긴
          뒤에만 마운트한다. */}
      {startUrl ? (
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
      ) : (
        <View style={styles.webview} />
      )}

      {/* 상단 공지 배너 — 레지스트리 detail.noticeBanner가 있는 미니앱에만. GLASS_AVAILABLE이면
          Liquid Glass, 아니면 흰 박스+shadow 폴백(GlassSurface 내부 분기). 탭하면 닫힘. */}
      {detail?.noticeBanner && noticeVisible && (
        <View style={styles.topNotice} pointerEvents="box-none">
          <GlassSurface interactive style={styles.topNoticePill}>
            <View style={styles.topNoticeInner}>
              <View style={styles.topNoticeText}>
                <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900} numberOfLines={1}>
                  {detail.noticeBanner.title}
                </Txt>
                <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
                  {detail.noticeBanner.subtitle}
                </Txt>
              </View>
              <Pressable
                onPress={() => setNoticeVisible(false)}
                style={styles.topNoticeClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="공지 닫기"
              >
                <XIcon size={18} color={SdsColors.grey500} weight="bold" />
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      )}

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
                  <ServiceLogo logoUri={logoUri} faviconUri={favicon} size={18} />
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

      {/* 페이지 정보 시트 — [로고(우하단 인증 배지) · 서비스명] + (서비스별 소개 문구). */}
      <Sheet
        open={infoOpen}
        onDismiss={() => setInfoOpen(false)}
        position={{ kind: 'stuck', detent: 'medium' }}
        backdrop
      >
        <Sheet.View style={styles.infoSheet}>
        <View style={styles.infoRow}>
          {/* 로고 + (인증 미니앱이면) 우하단 인증 체크 배지(흰 링으로 분리). */}
          <View style={styles.infoLogoWrap}>
            <ServiceLogo logoUri={logoUri} faviconUri={favicon} size={40} />
            {detail?.verified ? (
              <View style={styles.infoBadge}>
                <SealCheckIcon size={18} weight="fill" color={VERIFIED_COLOR} />
              </View>
            ) : null}
          </View>
          <Txt
            typography="t5"
            fontWeight="bold"
            color={SdsColors.grey900}
            numberOfLines={1}
            style={styles.infoName}
          >
            {serviceName || pageTitle}
          </Txt>
        </View>
        {/* 서비스별 소개 — 레지스트리 detail.description이 있는 미니앱에만. */}
        {detail?.description ? (
          <Txt typography="t6" color={SdsColors.grey600} style={styles.infoDesc}>
            {detail.description}
          </Txt>
        ) : null}
        {/* 관련 링크 — 레지스트리 detail.relatedLinks. */}
        {detail && detail.relatedLinks.length > 0 ? (
          <View style={styles.infoLinks}>
            {detail.relatedLinks.map((link) => (
              <LinkRow
                key={link.url}
                label={link.label}
                url={link.url}
                onPress={() => openLink(link.url)}
              />
            ))}
          </View>
        ) : null}
        </Sheet.View>
      </Sheet>

      {/* 더보기(⋯) 액션 시트 — Safari 스타일 액션 목록. 콘텐츠 높이에 맞춰 hug. */}
      <Sheet
        open={moreOpen}
        onDismiss={() => setMoreOpen(false)}
        position={{ kind: 'fit' }}
        backdrop
      >
        <Sheet.View style={styles.infoSheet}>
        <View style={styles.menuList}>
          <MenuRow icon={ArrowClockwiseIcon} label="새로고침" onPress={handleMenuRefresh} />
          <MenuRow icon={ShareNetworkIcon} label="공유하기" onPress={handleShare} />
          {miniAppId ? (
            <MenuRow icon={HouseIcon} label="홈 화면에 추가" onPress={handleAddToHome} />
          ) : null}
          <MenuRow icon={GearSixIcon} label="설정" onPress={handleSettings} />
          <MenuRow icon={HeadsetIcon} label="고객센터" onPress={handleSupport} />
        </View>
        </Sheet.View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SdsColors.background },
  webview: { flex: 1 },
  // 상단 공지 배너 — 헤더 아래 떠서 콘텐츠 위를 덮음(좌우 여백 + 가운데 정렬).
  topNotice: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  topNoticePill: {
    alignSelf: 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
  },
  topNoticeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 12,
  },
  topNoticeText: {
    flex: 1,
    gap: 2,
  },
  topNoticeClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // 페이지 정보 시트 행 — [로고(+인증 배지) · 서비스명].
  /**
   * The gutter the old SDS BottomSheet used to bake into its own content
   * wrapper. `Sheet` leaves the content alone, so a sheet that wants a gutter
   * says so — which is what lets the campus sheet's own content sit flush to a
   * card edge that moves.
   */
  infoSheet: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLogoWrap: {
    width: 40,
    height: 40,
  },
  // 우하단 인증 배지 — 흰 링(원형 배경)으로 로고와 분리.
  infoBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  infoName: {
    flex: 1,
  },
  // 서비스 소개 문구 — 로고 행 아래, 읽기 편한 줄간격.
  infoDesc: {
    marginTop: 16,
    lineHeight: 22,
  },
  // 관련 링크 목록 — 소개 문구 아래 [체인아이콘 · (라벨/URL)] 행 스택.
  infoLinks: {
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  linkTextCol: {
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
