import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretRightIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { handleSduiAction } from '@/sdui/action-handler';
import { DeptNoticesSection } from './DeptNoticesSection';

const HOME_GRID_ITEMS: readonly TossfaceGridItem[] = [
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
];

export function HomeScreen() {
  useT();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dept latest notices (top 3) ── */}
        <DeptNoticesSection />

        {/* ── Banner Card ── */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerSubtitle}>
              스꾸버스 앱에서 확인하기 ›
            </Text>
            <Text style={styles.bannerTitle}>
              캠퍼스 생활의 모든 것, 한 곳에서
            </Text>
            <Text style={styles.bannerDesc}>
              셔틀 실시간 위치부터 건물 검색까지
            </Text>
          </View>
        </View>

        {/* ── Grid Menu (tossface, matches Campus tab style) ── */}
        <View style={styles.gridWrap}>
          <TossfaceButtonGrid items={HOME_GRID_ITEMS} />
        </View>

        {/* ── Bottom Banner ── */}
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
  },
  bannerContent: {
    gap: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: SdsColors.brand,
    fontWeight: '500',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: SdsColors.grey900,
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
