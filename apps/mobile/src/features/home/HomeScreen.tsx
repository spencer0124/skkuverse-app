import { useMemo } from 'react';
import {
  Platform,
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
// import { CaretRightIcon } from 'phosphor-react-native';  // 하단 배너 전용
import {
  SdsColors,
  defaultHomeLayout,
  useHomeLayout,
  useMiniAppIndex,
  useT,
  type HomeSection,
  type MiniAppIndexEntry,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { openMiniAppById } from '@/features/mini-app/open';
import { logHomeContentSelect } from '@/services/analytics';
import { DeptNoticesSection } from './DeptNoticesSection';
import { ExternalActivitiesSection } from './ExternalActivitiesSection';
import { HomeBannerCarousel } from './HomeBannerCarousel';

// Logo is a remote image (`{uri}`) or an emoji. A null logo (the server sent
// one this build cannot use) draws 🧩 rather than an empty tile.
function toTile(app: MiniAppIndexEntry): TossfaceGridItem {
  return {
    id: app.id,
    title: app.shortName ?? app.name,
    ...(app.homeLogo?.kind === 'remote'
      ? { imageSource: { uri: app.homeLogo.uri } }
      : {
          emoji: app.homeLogo?.kind === 'emoji' ? app.homeLogo.emoji : '\u{1F9E9}',
        }),
    onPress: () => {
      logHomeContentSelect({ content_type: 'tile', item_id: app.id });
      openMiniAppById(app.id);
    },
  };
}

type RenderedSection =
  | { type: 'banner'; key: string; section: Extract<HomeSection, { type: 'banner_carousel' }> }
  | { type: 'grid'; key: string; title?: string; items: TossfaceGridItem[] };

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

  // Home = server-driven sections (GET /ui/home), drawn in the server's order:
  // the banner carousel and titled mini-app grids. Grids carry ids only; names
  // and logos are joined from the mini-app registry, and an id the registry
  // does not (yet) know is skipped. A grid left with no tiles is dropped whole,
  // title included.
  //
  // With no layout at all (first launch offline, or a server predating
  // /ui/home) it draws the bundled copy of today's server layout instead.
  const { data: fetched } = useHomeLayout();
  const { data: miniApps } = useMiniAppIndex();
  const layout = useMemo(() => fetched ?? defaultHomeLayout(t), [fetched, t]);
  const sections = useMemo<RenderedSection[]>(() => {
    const byId = new Map((miniApps ?? []).map((app) => [app.id, app]));
    const out: RenderedSection[] = [];
    for (const section of layout.sections) {
      if (section.type === 'banner_carousel') {
        out.push({ type: 'banner', key: section.id, section });
        continue;
      }
      const items = section.miniAppIds
        .map((id) => byId.get(id))
        .filter((app): app is MiniAppIndexEntry => app !== undefined)
        .map(toTile);
      if (items.length > 0) {
        out.push({ type: 'grid', key: section.id, title: section.title, items });
      }
    }
    return out;
  }, [layout, miniApps]);

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
        {sections.map((section) =>
          section.type === 'banner' ? (
            <HomeBannerCarousel key={section.key} section={section.section} />
          ) : (
            <View key={section.key} style={styles.gridWrap}>
              {section.title ? (
                <View style={styles.sectionHeader}>
                  <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
                    {section.title}
                  </Txt>
                </View>
              ) : null}
              <TossfaceButtonGrid items={section.items} />
            </View>
          ),
        )}

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

  /* ── Mini-app section heading ── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
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
