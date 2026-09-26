import { Fragment, useMemo } from 'react';
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
  type HomeTile,
  type MiniAppIndexEntry,
  type MiniAppLogo,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { openMiniAppById } from '@/features/mini-app/open';
import { handleSduiAction } from '@/sdui/action-handler';
import { logHomeContentSelect } from '@/services/analytics';
import { DeptNoticesSection } from './DeptNoticesSection';
import { ExternalActivitiesSection } from './ExternalActivitiesSection';
import { HomeBannerCarousel } from './HomeBannerCarousel';
import { isNativeGameId, NATIVE_GAME_IDS, type NativeGameId } from '@/features/games/ids';
import { HomeHallOfFame } from '@/features/games/leaderboard/HomeHallOfFame';
import { NATIVE_GAMES } from '@/features/games/registry';

/** A tile for a game bundled with the app: it opens the native game screen. */
function gameTile(id: NativeGameId, title: string): TossfaceGridItem {
  return {
    id,
    title,
    emoji: NATIVE_GAMES[id].homeEmoji,
    onPress: () => {
      logHomeContentSelect({ content_type: 'tile', item_id: id });
      openMiniAppById(id);
    },
  };
}

// Logo is a remote image (`{uri}`) or an emoji. A null logo (the server sent
// one this build cannot use) draws 🧩 rather than an empty tile.
function logoProps(logo: MiniAppLogo | null): Pick<TossfaceGridItem, 'emoji' | 'imageSource'> {
  return logo?.kind === 'remote'
    ? { imageSource: { uri: logo.uri } }
    : { emoji: logo?.kind === 'emoji' ? logo.emoji : '\u{1F9E9}' };
}

function toTile(app: MiniAppIndexEntry): TossfaceGridItem {
  return {
    id: app.id,
    title: app.shortName ?? app.name,
    ...logoProps(app.homeLogo),
    onPress: () => {
      logHomeContentSelect({ content_type: 'tile', item_id: app.id });
      openMiniAppById(app.id);
    },
  };
}

/** A tile that brings its own text, icon and action: an app screen, a page. */
function linkTile(tile: Extract<HomeTile, { kind: 'link' }>): TossfaceGridItem {
  return {
    id: tile.id,
    title: tile.title,
    ...logoProps(tile.icon),
    onPress: () => {
      logHomeContentSelect({ content_type: 'tile', item_id: tile.id });
      handleSduiAction(tile.action);
    },
  };
}

type RenderedSection =
  | { type: 'banner'; key: string; section: Extract<HomeSection, { type: 'banner_carousel' }> }
  | { type: 'grid'; key: string; title?: string; items: TossfaceGridItem[]; gameIds: NativeGameId[] };

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
  // the banner carousel and titled tile grids. Each tile names where its text
  // and icon come from: a `miniapp` is joined from the mini-app registry, a
  // `game` from the games bundled into this build, and a `link` carries its own.
  // A tile this build cannot resolve (an id the registry does not know, a game
  // it does not ship) is skipped, and a grid left with no tiles is dropped
  // whole, title included.
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
      const items: TossfaceGridItem[] = [];
      const gameIds: NativeGameId[] = [];
      for (const tile of section.tiles) {
        if (tile.kind === 'game') {
          if (!isNativeGameId(tile.id)) continue;
          items.push(gameTile(tile.id, t(NATIVE_GAMES[tile.id].titleKey)));
          gameIds.push(tile.id);
        } else if (tile.kind === 'miniapp') {
          const app = byId.get(tile.id);
          if (app) items.push(toTile(app));
        } else {
          items.push(linkTile(tile));
        }
      }
      if (items.length > 0) {
        out.push({ type: 'grid', key: section.id, title: section.title, items, gameIds });
      }
    }
    return out;
  }, [layout, miniApps, t]);
  const unplacedGames = useMemo(() => {
    const placed = new Set(sections.flatMap((s) => (s.type === 'grid' ? s.gameIds : [])));
    return NATIVE_GAME_IDS.filter((id) => !placed.has(id));
  }, [sections]);
  // One Hall of Fame for every game on the screen, in the order their tiles
  // appear, under the first grid that holds one — or, when no server grid
  // does, under the app's own mini-games grid.
  const hallGames = useMemo(
    () => [...new Set([...sections.flatMap((s) => (s.type === 'grid' ? s.gameIds : [])), ...unplacedGames])],
    [sections, unplacedGames],
  );
  const hallAfter = sections.find((s) => s.type === 'grid' && s.gameIds.length > 0)?.key ?? null;

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
            <Fragment key={section.key}>
              <View style={styles.gridWrap}>
                {section.title ? (
                  <View style={styles.sectionHeader}>
                    <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
                      {section.title}
                    </Txt>
                  </View>
                ) : null}
                <TossfaceButtonGrid items={section.items} />
              </View>
              {section.key === hallAfter && <HomeHallOfFame gameIds={hallGames} />}
            </Fragment>
          ),
        )}

        {/* The in-app games the server's grids do not place get a grid of
            their own, fixed in the app, so none is ever unreachable. */}
        {unplacedGames.length > 0 && (
          <View style={styles.gridWrap}>
            <View style={styles.sectionHeader}>
              <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
                {t('home.section.miniGames')}
              </Txt>
            </View>
            <TossfaceButtonGrid items={unplacedGames.map((id) => gameTile(id, t(NATIVE_GAMES[id].titleKey)))} />
          </View>
        )}
        {hallAfter === null && <HomeHallOfFame gameIds={hallGames} />}

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
