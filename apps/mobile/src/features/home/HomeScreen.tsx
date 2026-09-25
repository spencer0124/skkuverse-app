import { useMemo } from 'react';
import {
  Platform,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useHeaderHeight } from '@react-navigation/elements';
// import { CaretRightIcon } from 'phosphor-react-native';  // 미니앱 섹션 헤더 전용 (더보기 버튼)
import {
  SdsColors,
  useMiniAppIndex,
  useT,
} from '@skkuverse/shared';
// import { Txt } from '@skkuverse/sds';  // 미니앱 섹션 헤더 전용
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { openMiniAppById } from '@/features/mini-app/open';
import { logHomeContentSelect } from '@/services/analytics';
import { DeptNoticesSection } from './DeptNoticesSection';
import { ExternalActivitiesSection } from './ExternalActivitiesSection';
import { HeroBanner } from './HeroBanner';

export function HomeScreen() {
  const { t } = useT();
  // headerTransparent: true (home tab) disables the automatic top inset
  // applied to UIScrollView; we add headerHeight back manually so content
  // starts below the bar and only slides under it on scroll (where the
  // scroll-edge blur kicks in). useHeaderHeight reflects the live header
  // height so it tracks safe-area changes and large-title states.
  //
  // iOS ONLY. `headerTransparent` is set inside the `Platform.OS === 'ios'`
  // branch of the home tab's Stack.Screen options, so Android keeps an opaque
  // Toolbar that already offsets the content below itself. Adding headerHeight
  // there too counted the bar twice and left a header-sized dead space at the
  // top of the screen.
  const headerHeight = useHeaderHeight();
  const scrollTopInset = Platform.OS === 'ios' ? headerHeight + 16 : 16;

  // 홈 그리드 = 서버 레지스트리(SSOT). 예전엔 여기가 공지/ESKARA/건물지도/건물코드를
  // 하드코딩한 정적 배열이었지만, 이제 그 타일들도 레지스트리 항목으로 옮겨갔다.
  // 이름/shortName/로고/순서 전부 서버에서 오고, `hidden: true`인 항목은 홈
  // 그리드에서만 걸러진다 — 딥링크·지도 버튼·미니앱 셸에서는 그대로 열린다.
  // 로고는 원격 이미지(`{uri}`) 또는 이모지 — 번들 require() 맵은 제거됨. 로고가
  // null(서버가 쓸 수 없는 로고를 보냄)이면 빈 칸 대신 🧩로 그린다.
  const { data: miniApps } = useMiniAppIndex();
  const miniAppItems = useMemo<readonly TossfaceGridItem[]>(
    () =>
      (miniApps ?? [])
        .filter((app) => !app.hidden)
        .map((app) => ({
          id: app.id,
          title: app.shortName ?? app.name,
          ...(app.logo?.kind === 'remote'
            ? { imageSource: { uri: app.logo.uri } }
            : { emoji: app.logo?.kind === 'emoji' ? app.logo.emoji : '\u{1F9E9}' }),
          onPress: () => {
            logHomeContentSelect({ content_type: 'tile', item_id: app.id });
            openMiniAppById(app.id);
          },
        })),
    [miniApps],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: scrollTopInset },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Banner (auto-playing intro animation) ── */}
        <HeroBanner />

        {/* ── ESKARA 축제 배너 ── 축제 기간 한정 (2026-09-24). 누르면 그리드의
            ESKARA 타일과 같은 미니앱이 열린다. 이미지는 공식 캐러셀 3장을 이어
            붙인 것(assets/images/eskara-banner.jpg). 축제가 끝나면 이 블록과
            eskaraBanner 스타일, Pressable·Image import를 함께 걷어낸다. */}
        <Pressable
          onPress={() => {
            logHomeContentSelect({ content_type: 'banner', item_id: 'eskara' });
            openMiniAppById('eskara-2026');
          }}
          style={({ pressed }) => [styles.eskaraBanner, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('home.tile.eskara')}
        >
          <Image
            source={require('../../../assets/images/eskara-banner.jpg')}
            style={styles.eskaraBannerImage}
            contentFit="cover"
          />
        </Pressable>

        {/* ── Grid Menu (registry-driven) ──
            정적 타일(공지/ESKARA/건물지도/건물코드)은 서버 레지스트리로 옮겨갔다.
            아래 두 항목은 예전 정적 그리드에서 이미 주석 처리돼 있던 것으로,
            되살릴 일이 생기면 참고하도록 여기 보류해 둔다:
            {
              id: 'original_series',
              title: t('home.tile.originalSeries'),
              emoji: '\u{1F3AC}',
              onPress: () => {
                logHomeContentSelect({ content_type: 'tile', item_id: 'original_series' });
                router.push('/video-gallery' as never);
              },
            },
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
        */}
        <View style={styles.gridWrap}>
          <TossfaceButtonGrid items={miniAppItems} />
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

  /* ── ESKARA 축제 배너 ── HeroBanner 카드와 같은 가로 여백·모서리 */
  eskaraBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  eskaraBannerImage: {
    width: '100%',
    // 원본 비율(2400×1251) 그대로 — 가운데 타이틀이 잘리지 않게.
    aspectRatio: 2400 / 1251,
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
