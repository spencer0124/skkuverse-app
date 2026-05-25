import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BellIcon, BookmarkSimpleIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { defaultHeaderOptions } from '@/lib/header-options';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { logNoticesContentSelect } from '@/services/analytics';

// Notices tab uses the NATIVE iOS bar (UINavigationBar) for the top chrome
// — same `unstable_headerRightItems` API as the home tab so the bookmark +
// bell buttons get the system Liquid Glass capsule treatment automatically.
// The 9-tab strip lives inside the FlatList ListHeaderComponent (see
// NoticesTabStrip.tsx + NoticesTabScreen.tsx + NoticeListPanel.tsx),
// preserving the iOS 26 NativeTabs `tabBarMinimizeBehavior` chain-root rule
// (RNSScreen subviews[0] = FlatList = UIScrollView). The bottom
// NoticesAccessoryBar continues to surface on scroll-down minimize because
// it's an independent `bottomAccessory` slot on the parent NativeTabs.
//
// Icon set:
//   - bookmark-simple → /notices/saved (mirrors the bottom accessory bar's
//     bookmark action, surfaced in the top bar so the saved list is also
//     reachable when the tab bar is expanded — accessory bar is only
//     visible when minimized).
//   - bell → /notifications/notices (per-tab notice notification settings;
//     dedicated screen for "공지 알림" rather than the top-level overview).
//
// Note: home tab uses `headerTransparent: true` + `headerBlurEffect` for a
// scroll-edge transparent bar, but home's screen body has its own layout
// that positions content below the safe area. notices' screen root is a
// FlatList — iOS doesn't always auto-inset nested scroll views inside
// react-native-screens' native-stack, so transparent + blur leaves the
// listHeader (9-tab strip) hidden under the bar. We use the opaque
// inherited white from defaultHeaderOptions instead — bar pushes content
// down naturally and the 9-tab strip is visible at the FlatList top.
export default function NoticesTabStackLayout() {
  const router = useRouter();
  const { t } = useT();
  return (
    <Stack screenOptions={defaultHeaderOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          ...(Platform.OS === 'ios'
            ? {
                unstable_headerRightItems: () => [
                  {
                    type: 'button' as const,
                    label: t('notices.accessory.bookmark'),
                    icon: {
                      type: 'image' as const,
                      source: require('../../../assets/header-icons/bookmark-simple.png'),
                      tinted: false,
                    },
                    sharesBackground: false,
                    accessibilityLabel: t('notices.accessory.bookmark'),
                    onPress: () => {
                      logNoticesContentSelect({ content_type: 'header_bookmark', item_id: 'saved' });
                      router.push('/notices/saved' as never);
                    },
                  },
                  {
                    type: 'button' as const,
                    label: t('settings.notifications'),
                    icon: {
                      type: 'image' as const,
                      source: require('../../../assets/header-icons/bell.png'),
                      tinted: false,
                    },
                    sharesBackground: false,
                    accessibilityLabel: t('settings.notifications'),
                    onPress: () => {
                      logNoticesContentSelect({ content_type: 'header_bell', item_id: 'notifications' });
                      router.push('/notifications/notices' as never);
                    },
                  },
                ],
              }
            : {
                headerRight: () => (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <HeaderIconButton
                      onPress={() => {
                        logNoticesContentSelect({ content_type: 'header_bookmark', item_id: 'saved' });
                        router.push('/notices/saved' as never);
                      }}
                      accessibilityLabel={t('notices.accessory.bookmark')}
                    >
                      <BookmarkSimpleIcon
                        size={22}
                        color={SdsColors.grey700}
                      />
                    </HeaderIconButton>
                    <HeaderIconButton
                      onPress={() => {
                        logNoticesContentSelect({ content_type: 'header_bell', item_id: 'notifications' });
                        router.push('/notifications/notices' as never);
                      }}
                      accessibilityLabel={t('settings.notifications')}
                    >
                      <BellIcon size={22} color={SdsColors.grey700} />
                    </HeaderIconButton>
                  </View>
                ),
              }),
        }}
      />
    </Stack>
  );
}
