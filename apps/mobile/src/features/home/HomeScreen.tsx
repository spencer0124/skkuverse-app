import { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  // Pressable, // restore with bottom banner below
  // Text, // restore with bottom banner below
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
// import { CaretRightIcon } from 'phosphor-react-native'; // restore with bottom banner below
import {
  SdsColors,
  useAuthStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { handleSduiAction } from '@/sdui/action-handler';
import { logHomeContentSelect } from '@/services/analytics';
import { DeptNoticesSection } from './DeptNoticesSection';
import { ExternalActivitiesSection } from './ExternalActivitiesSection';
import { HomeOnboardingGateCard } from './HomeOnboardingGateCard';
import { HeroBanner } from './HeroBanner';

export function HomeScreen() {
  const { t } = useT();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const showOnboardingGate = isAnonymous || !onboardingCompleted;
  // headerTransparent: true (home tab) disables the automatic top inset
  // applied to UIScrollView; we add headerHeight back manually so content
  // starts below the bar and only slides under it on scroll (where the
  // scroll-edge blur kicks in). useHeaderHeight reflects the live header
  // height so it tracks safe-area changes and large-title states.
  const headerHeight = useHeaderHeight();

  const gridItems = useMemo<readonly TossfaceGridItem[]>(
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
        id: 'campus_map',
        title: t('home.tile.campusMap'),
        emoji: '\u{1F9ED}',
        onPress: () => {
          logHomeContentSelect({ content_type: 'tile', item_id: 'campus_map' });
          router.navigate('/(tabs)/campus' as never);
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

        {/* ── Grid Menu (tossface, matches Campus tab style) ── */}
        <View style={styles.gridWrap}>
          <TossfaceButtonGrid items={gridItems} />
        </View>

        {/* ── Dept latest notices (top 3) + 대외활동 — gated for non-onboarded users ── */}
        {showOnboardingGate ? (
          <HomeOnboardingGateCard />
        ) : (
          <>
            <DeptNoticesSection />
            <ExternalActivitiesSection />
          </>
        )}

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
    marginBottom: 36,
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
