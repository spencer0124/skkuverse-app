import { useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { CaretRightIcon } from 'phosphor-react-native';
import {
  SdsColors,
  useT,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { handleSduiAction } from '@/sdui/action-handler';
import { openMiniApp } from '@/features/in-app-browser/open';
import { MINI_APP_LOGOS } from '@/features/in-app-browser/mini-app-logos';
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
      {
        id: 'youtube_player',
        title: '유튜브',
        emoji: '\u{1F3AC}',
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'youtube_player' });
          router.push('/video-gallery' as never);
        },
      },
      {
        id: 'building_map',
        title: t('home.tile.buildingMap'),
        emoji: '\u{1F3E2}',
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'building_map' });
          router.navigate('/(tabs)/campus' as never);
          handleSduiAction({
            actionType: 'webview',
            actionValue: 'https://webview.skkuuniverse.com/#/map/hssc',
            webviewTitle: t('home.tile.buildingMap'),
            webviewColor: '003626',
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
    ],
    [router, t],
  );

  const miniAppItems = useMemo<readonly TossfaceGridItem[]>(
    () => [
      {
        id: 'council_hssc',
        title: '인사캠 총학',
        imageSource: MINI_APP_LOGOS['인사캠 총학생회'],
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'council_hssc' });
          openMiniApp({
            serviceName: '인사캠 총학생회',
            startUrl: 'http://student.skku.edu/student/notice2.do',
          });
        },
      },
      {
        id: 'council_nsc',
        title: '자과캠 총학',
        imageSource: MINI_APP_LOGOS['자과캠 총학생회'],
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'council_nsc' });
          openMiniApp({
            serviceName: '자과캠 총학생회',
            startUrl: 'http://student.skku.edu/student/notice3.do',
          });
        },
      },
      {
        id: 'skkuw',
        title: '성대신문',
        imageSource: MINI_APP_LOGOS['성대신문'],
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'skkuw' });
          openMiniApp({ serviceName: '성대신문', startUrl: 'http://www.skkuw.com/' });
        },
      },
      {
        id: 'skkuzine',
        title: '성균웹진',
        imageSource: MINI_APP_LOGOS['성균웹진'],
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'skkuzine' });
          openMiniApp({
            serviceName: '성균웹진',
            startUrl: 'https://webzine.skku.edu/skkuzine/index.do',
          });
        },
      },
    ],
    [],
  );

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

        {/* ── 미니앱 섹션 ── */}
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
