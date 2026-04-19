import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Map,
  Navigation,
  Building2,
  Coffee,
  Bus,
  Compass,
  Bookmark,
  Calendar,
  ChevronRight,
  User,
} from 'lucide-react-native';
import { Txt, Button, Dialog } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useAuthStore, useT } from '@skkuverse/shared';
import { signOutFromGoogle } from '@/services/google-auth';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_MARGIN = 16;
const GRID_GAP = 8;
const GRID_COLS = 4;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_MARGIN * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

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
  const { t } = useT();

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);
  const photoURL = useAuthStore((s) => s.photoURL);

  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const showProfile = !isAnonymous || isSigningOut;

  const handleGridPress = useCallback(
    (route: string | null) => {
      if (route) router.push(route as never);
    },
    [router],
  );

  const handleSignOut = async () => {
    setShowSignOutDialog(false);
    await signOutFromGoogle();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile / Login (moved from former '전체' tab) ── */}
        {showProfile ? (
          <View style={styles.profileCard}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <User size={28} color={SdsColors.grey500} />
              </View>
            )}
            <View style={styles.profileText}>
              <Txt typography="t5" fontWeight="semibold" color={SdsColors.grey900}>
                {displayName ?? ''}
              </Txt>
              <Txt typography="t7" color={SdsColors.grey500}>
                {email ?? ''}
              </Txt>
            </View>
          </View>
        ) : (
          <View style={styles.loginCard}>
            <Txt typography="t6" color={SdsColors.grey500} style={styles.loginPrompt}>
              {t('auth.loginPrompt')}
            </Txt>
            <Button
              type="primary"
              size="medium"
              onPress={() => router.push('/login')}
            >
              {t('auth.googleSignIn')}
            </Button>
          </View>
        )}

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

        {/* ── Sign-out button (for signed-in users, moved from former '전체' tab) ── */}
        {showProfile && (
          <View style={styles.signOutSection}>
            <Button
              type="danger"
              style="weak"
              size="medium"
              display="block"
              onPress={() => setShowSignOutDialog(true)}
            >
              {t('auth.signOut')}
            </Button>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Dialog.Confirm
        open={showSignOutDialog}
        description={t('auth.signOutConfirm')}
        onClose={() => setShowSignOutDialog(false)}
        leftButton={
          <Button
            type="dark"
            style="weak"
            size="medium"
            display="block"
            onPress={() => setShowSignOutDialog(false)}
          >
            {t('common.close')}
          </Button>
        }
        rightButton={
          <Button
            type="danger"
            size="medium"
            display="block"
            onPress={handleSignOut}
          >
            {t('auth.signOut')}
          </Button>
        }
      />
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

  /* ── Profile ── */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.lg,
    gap: SdsSpacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  loginCard: {
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.xxl,
    gap: SdsSpacing.lg,
  },
  loginPrompt: {
    textAlign: 'center',
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

  /* ── Sign-out ── */
  signOutSection: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.lg,
  },

  bottomSpacer: {
    height: 80,
  },
});
