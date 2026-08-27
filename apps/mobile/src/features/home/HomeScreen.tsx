import { useMemo } from 'react';
import {
  View,
  ScrollView,
  // Pressable,  // 미니앱 섹션 '더보기' 전용 — 섹션과 함께 주석 처리
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
// import { CaretRightIcon } from 'phosphor-react-native';  // 미니앱 섹션 전용
import {
  SdsColors,
  // useMiniAppIndex,  // 미니앱 섹션과 함께 주석 처리
  useT,
} from '@skkuverse/shared';
// import { Txt } from '@skkuverse/sds';  // 미니앱 섹션 헤더 전용
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { handleSduiAction } from '@/sdui/action-handler';
// import { openMiniAppById } from '@/features/mini-app/open';  // 미니앱 섹션 전용
import { logHomeContentSelect } from '@/services/analytics';
import { DeptNoticesSection } from './DeptNoticesSection';
import { ExternalActivitiesSection } from './ExternalActivitiesSection';
import { HeroBanner } from './HeroBanner';

export function HomeScreen() {
  const { t } = useT();
  const router = useRouter();
  // headerTransparent: true (home tab) disables the automatic top inset
  // applied to UIScrollView; we add headerHeight back manually so content
  // starts below the bar and only slides under it on scroll (where the
  // scroll-edge blur kicks in). useHeaderHeight reflects the live header
  // height so it tracks safe-area changes and large-title states.
  const headerHeight = useHeaderHeight();

  const mainGridItems = useMemo<readonly TossfaceGridItem[]>(
    () => [
      {
        id: 'notices',
        title: t('home.tile.notices'),
        emoji: '\u{1F4E2}',
        isNew: true,
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'notices' });
          router.navigate('/(tabs)/notices' as never);
        },
      },
      // 오리지널 시리즈 — 임시 비노출 (2026-08-01). 영상 화면/라우트(/video-gallery)는
      // 네이티브 의존(expo-screen-orientation, expo-linear-gradient) 때문에 feat/native로
      // 옮겨졌고 dev에는 존재하지 않는다 — 복구는 3.6.0 네이티브 빌드와 함께. 번역 키
      // (home.tile.originalSeries)만 여기 남겨둔다.
      // {
      //   id: 'original_series',
      //   title: t('home.tile.originalSeries'),
      //   emoji: '\u{1F3AC}',
      //   onPress: () => {
      //     logHomeContentSelect({ content_type: 'tile', item_id: 'original_series' });
      //     router.push('/video-gallery' as never);
      //   },
      // },
      {
        id: 'building_map',
        title: t('home.tile.buildingMap'),
        emoji: '\u{1F3E2}',
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'building_map' });
          router.navigate('/(tabs)/campus' as never);
          // 네이티브 SVG 지도. 서버는 이미 `route` → /map/hssc로 바뀌었는데 이 타일만
          // 죽은 webview 지도(webview.skkuuniverse.com/#/map/hssc)를 계속 열고 있었다.
          handleSduiAction({
            actionType: 'route',
            actionValue: '/map/hssc',
          });
        },
      },
      {
        id: 'building_code',
        title: t('home.tile.buildingCode'),
        emoji: '\u{1F522}',
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'building_code' });
          router.navigate('/(tabs)/campus' as never);
          handleSduiAction({
            actionType: 'route',
            actionValue: '/search',
          });
        },
      },
      // 오리지널 시리즈가 빠지며 생긴 4번째 칸. 이동 탭 바로가기였다가 분실물로
      // 교체 — 이동은 탭바에 이미 있어서 타일이 한 번 더 말하는 것뿐이었고,
      // 분실물은 캠퍼스 탭 하단 시트에만 있어 탭을 옮겨야 닿는 항목이었다.
      // 액션은 서버 `/ui/home/campus`의 lost_found 항목과 같은 값을 쓴다.
      {
        id: 'lost_found',
        title: t('lostAndFound.title'),
        emoji: '\u{1F9F3}',
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'lost_found' });
          handleSduiAction({
            actionType: 'webview',
            actionValue: 'https://webview.skkuverse.com/skku/lostandfound',
            webviewTitle: t('lostAndFound.title'),
            webviewColor: '003626',
          });
        },
      },
    ],
    [router, t],
  );

  // 미니앱 그리드 — 임시 비노출 (2026-08-01). 서버 레지스트리(SSOT)에서 생성.
  // 이름/URL/로고/순서 전부 서버에서. 로고는 원격 URL(`{uri}`) — 번들 require()
  // 맵은 제거됨. 서버가 아직 응답하지 않았거나 로고가 없으면 undefined라 타일은
  // 이모지 폴백으로 그려진다. 훅까지 같이 주석 처리해야 불필요한 /mini-apps
  // 쿼리가 안 나간다 (JSX만 지우면 fetch는 계속 돎).
  // const { data: miniApps } = useMiniAppIndex();
  // const miniAppItems = useMemo<readonly TossfaceGridItem[]>(
  //   () =>
  //     (miniApps ?? []).map((app) => ({
  //       id: app.id,
  //       title: app.shortName ?? app.name,
  //       imageSource: app.logo ? { uri: app.logo.uri } : undefined,
  //       onPress: () => {
  //         logHomeContentSelect({ content_type: 'tile', item_id: app.id });
  //         openMiniAppById(app.id);
  //       },
  //     })),
  //   [miniApps],
  // );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Banner (auto-playing intro animation) ── */}
        <HeroBanner />

        {/* ── Grid Menu (main app tiles) ── */}
        <View style={styles.gridWrap}>
          <TossfaceButtonGrid items={mainGridItems} />
        </View>

        {/* ── 미니앱 섹션 ── 임시 비노출 (2026-08-01). 되살릴 때 위쪽
            useMiniAppIndex/miniAppItems 블록과 Pressable·CaretRightIcon·Txt
            import도 함께 복구할 것.
        <View style={styles.miniAppsSection}>
          <View style={styles.sectionHeader}>
            <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
              미니앱
            </Txt>
            <Pressable
              style={({ pressed }) => [
                styles.sectionMoreBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={8}
            >
              <Txt typography="t7" color={SdsColors.grey500}>
                더보기
              </Txt>
              <CaretRightIcon size={12} color={SdsColors.grey400} />
            </Pressable>
          </View>
          <TossfaceButtonGrid items={miniAppItems} />
        </View>
        */}

        {/* ── Dept latest notices (top 3, gate handled inside) + 소식 ── */}
        <DeptNoticesSection />
        <ExternalActivitiesSection />

        {/* ── Bottom Banner ── (temporarily disabled — restore with CaretRightIcon import above)
        <Pressable style={styles.bottomBanner}>
          <View>
            <Text style={styles.bottomBannerTitle}>
              <Text style={styles.bottomBannerBold}>캠퍼스 지도</Text>에서
              건물 정보를 확인하세요!
            </Text>
            <View style={styles.bottomBannerBtn}>
              <Text style={styles.bottomBannerBtnText}>지도 열기</Text>
              <CaretRightIcon size={14} color={SdsColors.brand} />
            </View>
          </View>
        </Pressable>
        */}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  /* ── Grid wrap ── */
  gridWrap: {
    marginBottom: 24,
  },

  /* ── 미니앱 섹션 ── */
  miniAppsSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  /* ── Bottom Banner ── */
  bottomBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 20,
  },
  bottomBannerTitle: {
    fontSize: 15,
    color: SdsColors.grey800,
    lineHeight: 22,
  },
  bottomBannerBold: {
    fontWeight: '700',
  },
  bottomBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: SdsColors.brandLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  bottomBannerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: SdsColors.brand,
  },

  bottomSpacer: {
    height: 80,
  },
});
