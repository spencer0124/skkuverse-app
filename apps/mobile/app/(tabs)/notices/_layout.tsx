import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { DotsThreeIcon, UserCircleIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { defaultHeaderOptions } from '@/lib/header-options';
import { HeaderIconButton } from '@/lib/HeaderIconButton';

// Notices tab uses the NATIVE iOS bar (UINavigationBar) for the top chrome
// — same `unstable_headerRightItems` API as the home tab so the profile +
// kebab buttons get the system Liquid Glass capsule treatment automatically.
// The 9-tab strip lives inside the SectionList ListHeaderComponent (see
// NoticesTabStrip.tsx + NoticesTabScreen.tsx), preserving the iOS 26
// NativeTabs `tabBarMinimizeBehavior` chain-root rule (RNSScreen subviews[0]
// = SectionList = UIScrollView). The bottom NoticesAccessoryBar continues
// to surface on scroll-down minimize because it's an independent
// `bottomAccessory` slot on the parent NativeTabs.
//
// Note: home tab uses `headerTransparent: true` + `headerBlurEffect` for a
// scroll-edge transparent bar, but home's screen body has its own layout
// that positions content below the safe area. notices' screen root is a
// SectionList — iOS doesn't always auto-inset nested scroll views inside
// react-native-screens' native-stack, so transparent + blur leaves the
// listHeader (9-tab strip) hidden under the bar. We use the opaque
// inherited white from defaultHeaderOptions instead — bar pushes content
// down naturally and the 9-tab strip is visible at the SectionList top.
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
                    label: t('settings.account'),
                    icon: {
                      type: 'image' as const,
                      source: require('../../../assets/header-icons/user-circle.png'),
                      tinted: false,
                    },
                    sharesBackground: false,
                    accessibilityLabel: t('settings.account'),
                    onPress: () =>
                      router.push('/settings/account' as never),
                  },
                  {
                    type: 'button' as const,
                    label: t('settings.title'),
                    icon: {
                      type: 'image' as const,
                      source: require('../../../assets/header-icons/dots-three.png'),
                      tinted: false,
                    },
                    sharesBackground: false,
                    accessibilityLabel: t('settings.title'),
                    onPress: () => router.push('/settings' as never),
                  },
                ],
              }
            : {
                headerRight: () => (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <HeaderIconButton
                      onPress={() =>
                        router.push('/settings/account' as never)
                      }
                      accessibilityLabel={t('settings.account')}
                    >
                      <UserCircleIcon
                        size={22}
                        color={SdsColors.grey700}
                      />
                    </HeaderIconButton>
                    <HeaderIconButton
                      onPress={() => router.push('/settings' as never)}
                      accessibilityLabel={t('settings.title')}
                    >
                      <DotsThreeIcon
                        size={24}
                        color={SdsColors.grey700}
                        weight="bold"
                      />
                    </HeaderIconButton>
                  </View>
                ),
              }),
        }}
      />
    </Stack>
  );
}
