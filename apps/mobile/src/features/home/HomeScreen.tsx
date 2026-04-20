import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BellRing, ChevronRight, User } from 'lucide-react-native';
import { Txt, Button, Dialog } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useAuthStore, useT } from '@skkuverse/shared';
import { signOutFromGoogle } from '@/services/google-auth';
import {
  TossfaceButtonGrid,
  type TossfaceGridItem,
} from '@/components/TossfaceButtonGrid';
import { handleSduiAction } from '@/sdui/action-handler';

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
          <Pressable
            style={({ pressed }) => [
              styles.profileCard,
              pressed && styles.profileCardPressed,
            ]}
            onPress={() => router.push('/login')}
          >
            <View style={styles.avatarFallback}>
              <User size={28} color={SdsColors.grey500} />
            </View>
            <View style={styles.profileText}>
              <Txt typography="t5" fontWeight="semibold" color={SdsColors.grey900}>
                {t('auth.loginCardTitle')}
              </Txt>
              <Txt typography="t7" color={SdsColors.grey500}>
                {t('auth.loginPrompt')}
              </Txt>
            </View>
            <ChevronRight size={20} color={SdsColors.grey400} />
          </Pressable>
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
              <ChevronRight size={14} color={SdsColors.brand} />
            </View>
          </View>
        </Pressable>

        {/* ── Notification settings entry (Entry Point A) ── */}
        <Pressable
          style={({ pressed }) => [
            styles.settingsRow,
            pressed && styles.settingsRowPressed,
          ]}
          onPress={() => router.push('/notifications/settings' as never)}
        >
          <View style={styles.settingsIconWrap}>
            <BellRing size={20} color={SdsColors.grey700} />
          </View>
          <View style={styles.settingsTextWrap}>
            <Txt typography="t5" fontWeight="regular" color={SdsColors.grey900}>
              {t('notifications.settings')}
            </Txt>
          </View>
          <ChevronRight size={18} color={SdsColors.grey400} />
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

  /* ── Profile / Login card (same layout for both states) ── */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.lg,
    gap: SdsSpacing.md,
  },
  profileCardPressed: {
    backgroundColor: SdsColors.grey50,
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

  /* ── Grid wrap ── */
  gridWrap: {
    marginBottom: 20,
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

  /* ── Settings row (notification settings entry) ── */
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    gap: SdsSpacing.md,
  },
  settingsRowPressed: {
    backgroundColor: SdsColors.grey50,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: {
    flex: 1,
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
