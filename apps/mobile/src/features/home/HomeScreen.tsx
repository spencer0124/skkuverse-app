import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  // Pressable, // restore with bottom banner below
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
// import { CaretRightIcon } from 'phosphor-react-native'; // restore with bottom banner below
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsColors, SdsShadows, useT } from '@skkuverse/shared';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { handleSduiAction } from '@/sdui/action-handler';
import { DeptNoticesSection } from './DeptNoticesSection';

// iOS 26+ Liquid Glass capability — module-scope (runtime-constant).
const GLASS_AVAILABLE = isLiquidGlassAvailable();

export function HomeScreen() {
  useT();
  const router = useRouter();
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
        title: '공지',
        emoji: '\u{1F4E2}',
        onPress: () => router.navigate('/(tabs)/notices' as never),
      },
      {
        id: 'campus_map',
        title: '캠퍼스맵',
        emoji: '\u{1F9ED}',
        onPress: () => router.navigate('/(tabs)/campus' as never),
      },
      {
        id: 'building_map',
        title: '건물지도',
        emoji: '\u{1F3E2}',
        onPress: () => {
          router.navigate('/(tabs)/campus' as never);
          handleSduiAction({
            actionType: 'webview',
            actionValue: 'https://webview.skkuuniverse.com/#/map/hssc',
            webviewTitle: '건물지도',
            webviewColor: '003626',
          });
        },
      },
      {
        id: 'building_code',
        title: '건물코드',
        emoji: '\u{1F522}',
        onPress: () => {
          router.navigate('/(tabs)/campus' as never);
          handleSduiAction({
            actionType: 'route',
            actionValue: '/search',
          });
        },
      },
      {
        id: 'hssc_shuttle',
        title: '인사캠 셔틀',
        emoji: '\u{1F68C}',
        onPress: () => {
          // Switch to transit tab first so the back button from the realtime
          // screen returns to the transit list (matches the "이동 탭 가서
          // 인사캠 셔틀" mental model). groupId 'hssc' is the SSOT id from
          // skkuverse-server/features/bus/bus-config.data.js (screenType:
          // 'realtime', visibility: always).
          router.navigate('/(tabs)/transit' as never);
          router.push({
            pathname: '/bus/realtime',
            params: { groupId: 'hssc' },
          } as never);
        },
      },
      {
        id: 'inja_shuttle',
        title: '인자셔틀',
        emoji: '\u{1F690}',
        onPress: () => {
          // 인자셔틀 (INJA Shuttle, 인사캠↔자과캠) — groupId 'campus',
          // screenType 'schedule' (timetable-based, no live tracking). SSOT:
          // skkuverse-server/lib/i18n.js (busconfig.label.campus → 인자셔틀)
          // + bus-config.data.js. Same navigate-then-push pattern as HSSC so
          // back returns to the transit list.
          router.navigate('/(tabs)/transit' as never);
          router.push({
            pathname: '/bus/schedule',
            params: { groupId: 'campus' },
          } as never);
        },
      },
      {
        id: 'lost_found',
        title: '분실물',
        emoji: '\u{1F9F3}',
        onPress: () =>
          handleSduiAction({
            actionType: 'webview',
            actionValue: 'https://webview.skkuuniverse.com/#/skku/lostandfound',
            webviewTitle: '분실물',
            webviewColor: '003626',
          }),
      },
      {
        id: 'inquiry',
        title: '문의하기',
        emoji: '\u{1F4AC}',
        onPress: () =>
          handleSduiAction({
            actionType: 'external',
            actionValue: 'https://pf.kakao.com/_cjxexdG/chat',
          }),
      },
    ],
    [router],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 8 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banner Card ── */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            {GLASS_AVAILABLE ? (
              // iOS 26+ Liquid Glass chip — title sits inside a brand-tinted
              // glass capsule. brandLight base gives the glass material
              // something to refract over (banner bg is solid white).
              <View style={styles.titleGlassOuter}>
                <View style={styles.titleGlassFillBase}>
                  <GlassView
                    style={styles.titleGlassSurface}
                    glassEffectStyle="regular"
                  >
                    <Text style={styles.bannerTitle}>
                      스꾸버스 | 성균관 유니버스
                    </Text>
                  </GlassView>
                </View>
              </View>
            ) : (
              <Text style={styles.bannerTitle}>
                스꾸버스 | 성균관 유니버스
              </Text>
            )}
            <Text style={styles.bannerDesc}>
              캠퍼스 생활의 모든 것, 한 곳에서
            </Text>
          </View>
        </View>

        {/* ── Grid Menu (tossface, matches Campus tab style) ── */}
        <View style={styles.gridWrap}>
          <TossfaceButtonGrid items={gridItems} />
        </View>

        {/* ── Dept latest notices (top 3) ── */}
        <DeptNoticesSection />

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
    backgroundColor: '#fbfbfb',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  /* ── Banner ── */
  bannerCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 20,
    boxShadow: SdsShadows.card.boxShadow,
    ...SdsShadows.card.legacy,
  },
  bannerContent: {
    gap: 4,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: SdsColors.brandDark,
  },
  // iOS 26+ Liquid Glass title chip — text-width capsule (alignSelf: flex-start)
  // so the chip wraps tight around "스꾸버스 | 성균관 유니버스" rather than
  // stretching across the banner.
  titleGlassOuter: {
    alignSelf: 'flex-start',
    borderRadius: 14,
  },
  // Substrate that the glass material refracts over. Without a base tint, the
  // glass effect is barely visible on solid white (see HeaderIconButton.tsx
  // glassFillBase comment for the same pattern).
  titleGlassFillBase: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: SdsColors.brandLight,
  },
  titleGlassSurface: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerDesc: {
    fontSize: 13,
    color: SdsColors.grey600,
    marginTop: 2,
  },

  /* ── Grid wrap ── */
  gridWrap: {
    marginBottom: 20,
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
