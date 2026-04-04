import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  Bell,
  Settings,
  User,
  Map,
  Navigation,
  Building2,
  BookOpen,
  Coffee,
  Bus,
  Compass,
  Star,
  Bookmark,
  MessageCircle,
  Calendar,
  HelpCircle,
  ChevronRight,
} from 'lucide-react-native';
import { SdsColors } from '@skkuverse/shared';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_MARGIN = 16;
const GRID_GAP = 8;
const GRID_COLS = 4;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_MARGIN * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

/* ── Mock quick-action data ── */
const QUICK_ACTIONS = [
  { icon: BookOpen, label: '킹고포탈' },
  { icon: Calendar, label: '학사일정' },
  { icon: Star, label: '즐겨찾기' },
  { icon: Bookmark, label: '분실물' },
  { icon: MessageCircle, label: '커뮤니티' },
  { icon: HelpCircle, label: '문의하기' },
];

/* ── Mock grid menu data ── */
const GRID_ITEMS = [
  { icon: Bus, label: '셔틀버스', badge: null, route: '/(tabs)/transit' },
  { icon: Map, label: '캠퍼스맵', badge: null, route: '/(tabs)/campus' },
  { icon: Building2, label: '건물검색', badge: 'N', route: '/search' },
  { icon: Navigation, label: '길찾기', badge: null, route: null },
  { icon: Coffee, label: '편의시설', badge: null, route: null },
  { icon: Bookmark, label: '즐겨찾기', badge: null, route: null },
  { icon: Calendar, label: '학사일정', badge: null, route: null },
  { icon: Compass, label: '주변탐색', badge: null, route: null },
];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleGridPress = useCallback(
    (route: string | null) => {
      if (route) router.push(route as never);
    },
    [router],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Search Bar (commented out) ──
      <Pressable
        style={styles.searchBar}
        onPress={() => router.push('/search')}
      >
        <Search size={20} color={SdsColors.grey500} />
        <Text style={styles.searchText}>건물, 강의실 검색</Text>
      </Pressable>
      */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Section (commented out) ──
        <View style={styles.profileSection}>
          <View style={styles.profileLeft}>
            <View style={styles.avatar}>
              <User size={28} color={SdsColors.grey400} />
            </View>
            <View>
              <Text style={styles.profileName}>성균이</Text>
              <Text style={styles.profileSub}>성균관대학교</Text>
            </View>
          </View>
          <View style={styles.profileRight}>
            <Pressable style={styles.iconBtn}>
              <Bell size={22} color={SdsColors.grey700} />
            </Pressable>
            <Pressable style={styles.iconBtn}>
              <Settings size={22} color={SdsColors.grey700} />
            </Pressable>
          </View>
        </View>
        */}

        {/* ── Quick Actions (commented out) ──
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsContent}
          style={styles.quickActions}
        >
          {QUICK_ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable key={item.label} style={styles.quickActionItem}>
                <Icon size={22} color={SdsColors.grey700} />
                <Text style={styles.quickActionLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        */}

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

        {/* ── Grid Menu ── */}
        <View style={styles.gridContainer}>
          {GRID_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                style={styles.gridItem}
                onPress={() => handleGridPress(item.route)}
              >
                <View style={styles.gridIconWrap}>
                  <Icon size={26} color={SdsColors.grey800} />
                  {item.badge && (
                    <View style={styles.gridBadge}>
                      <Text style={styles.gridBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.gridLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
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
              <ChevronRight size={14} color={SdsColors.brand} />
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
    backgroundColor: SdsColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  /* ── Search Bar ── */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    height: 48,
    borderRadius: 12,
    backgroundColor: SdsColors.grey100,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchText: {
    fontSize: 15,
    color: SdsColors.grey400,
  },

  /* ── Profile ── */
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  profileSub: {
    fontSize: 13,
    color: SdsColors.grey500,
    marginTop: 2,
  },
  profileRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Quick Actions ── */
  quickActions: {
    marginBottom: 16,
  },
  quickActionsContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  quickActionLabel: {
    fontSize: 11,
    color: SdsColors.grey700,
    fontWeight: '500',
  },

  /* ── Banner ── */
  bannerCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: SdsColors.brandLight,
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

  /* ── Grid ── */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 16,
    backgroundColor: SdsColors.grey50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
  },
  gridIconWrap: {
    position: 'relative',
  },
  gridBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#F04452',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: SdsColors.grey800,
  },

  /* ── Bottom Banner ── */
  bottomBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: SdsColors.grey50,
    padding: 20,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
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
