import { Stack, useRouter } from 'expo-router';
import { BellIcon, BellSlashIcon, BookmarkSimpleIcon, MagnifyingGlassIcon } from 'phosphor-react-native';
import { Platform, Text, View } from 'react-native';
import {
  SdsColors,
  SdsTypo,
  useAuthStore,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { OnboardingLanding } from '@/features/notices/components/OnboardingLanding';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

// PNG assets exported from phosphor SVGs via scripts/export-header-icons.mjs.
// Used by `unstable_headerRightItems` (iOS) — `type: 'button'` items route the
// icon through the native `headerRightBarButtonItems` prop which only accepts
// ImageSource (PNG) or SF Symbol. Each item also sets `sharesBackground: false`
// so iOS 26 gives it its own Liquid Glass capsule (vs the default merged group).
// Android falls through to the `headerRight` callback below.
const ICON_MAGNIFYING_GLASS = require('../../../assets/header-icons/magnifying-glass.png');
const ICON_BOOKMARK_SIMPLE = require('../../../assets/header-icons/bookmark-simple.png');
const ICON_BELL = require('../../../assets/header-icons/bell.png');
const ICON_BELL_SLASH = require('../../../assets/header-icons/bell-slash.png');

export default function NoticesTab() {
  useTabFocusTracking('notices');
  const router = useRouter();
  const { t } = useT();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const noticesCategoryEnabled = useNotificationStore(
    (s) => s.preferences.categoryEnabled?.notices ?? false,
  );

  // Header options set inline so the dynamic Bell/BellOff icon (driven by
  // noticesCategoryEnabled from Firestore-synced store) updates without a
  // tab focus event — the inline element re-renders on every store change.
  const screenOptions = (
    <Stack.Screen
      options={{
        // iOS: clear native title (UIKit always centers it). Toss-style left
        // title is rendered as a custom item in `unstable_headerLeftItems`
        // below with `hidesSharedBackground: true` so iOS 26 doesn't wrap the
        // text in a Liquid Glass capsule. Android: native-stack respects
        // `headerTitleAlign: 'left'` so the standard `title` prop is enough.
        title: Platform.OS === 'ios' ? '' : t('nav.notices'),
        headerTitleAlign: 'left',
        unstable_headerLeftItems: () => [
          {
            type: 'custom' as const,
            hidesSharedBackground: true,
            element: (
              <Text style={{ ...SdsTypo.t3, color: SdsColors.grey900 }}>
                {t('nav.notices')}
              </Text>
            ),
          },
        ],
        // iOS-only path: each `type:'button'` item becomes a real
        // RNSBarButtonItem (UIBarButtonItem subclass) with `sharesBackground:
        // false` so iOS 26 renders it in its own Liquid Glass capsule rather
        // than merging into the default shared-bg group. Native handler at
        // RNSBarButtonItem.mm:91 forwards `sharesBackground` to the underlying
        // UIBarButtonItem. `hidesSharedBackground` is NOT used — that prop
        // hides the capsule visualization entirely, which is the opposite of
        // what we want. Android falls through to `headerRight` below.
        unstable_headerRightItems: () => [
          {
            type: 'button' as const,
            label: '',
            icon: { type: 'image' as const, source: ICON_MAGNIFYING_GLASS, tinted: false },
            sharesBackground: false,
            accessibilityLabel: '검색',
            onPress: () => {
              // TODO: 검색 화면 라우트 연결
            },
          },
          {
            type: 'button' as const,
            label: '',
            icon: { type: 'image' as const, source: ICON_BOOKMARK_SIMPLE, tinted: false },
            sharesBackground: false,
            accessibilityLabel: '보관함',
            onPress: () => {
              // TODO: 보관함 화면 라우트 연결
            },
          },
          {
            type: 'button' as const,
            label: '',
            icon: {
              type: 'image' as const,
              source: noticesCategoryEnabled ? ICON_BELL : ICON_BELL_SLASH,
              tinted: false,
            },
            sharesBackground: false,
            accessibilityLabel: t('notifications.settings'),
            onPress: () => router.push('/notifications/settings' as never),
          },
        ],
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <HeaderIconButton
              onPress={() => {
                // TODO: 검색 화면 라우트 연결
              }}
              accessibilityRole="button"
              accessibilityLabel="검색"
            >
              <MagnifyingGlassIcon size={22} color={SdsColors.grey700} />
            </HeaderIconButton>
            <HeaderIconButton
              onPress={() => {
                // TODO: 보관함 화면 라우트 연결
              }}
              accessibilityRole="button"
              accessibilityLabel="보관함"
            >
              <BookmarkSimpleIcon size={22} color={SdsColors.grey700} />
            </HeaderIconButton>
            <HeaderIconButton
              onPress={() => router.push('/notifications/settings' as never)}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.settings')}
            >
              {noticesCategoryEnabled ? (
                <BellIcon size={22} color={SdsColors.grey700} />
              ) : (
                <BellSlashIcon size={22} color={SdsColors.grey500} />
              )}
            </HeaderIconButton>
          </View>
        ),
      }}
    />
  );

  if (isAnonymous || !onboardingCompleted) {
    return (
      <>
        {screenOptions}
        <OnboardingLanding
          onStartPress={() => router.push('/onboarding')}
        />
      </>
    );
  }

  return (
    <>
      {screenOptions}
      <NoticesTabScreen />
    </>
  );
}
