import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { DotsThreeIcon, UserCircleIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { HomeScreen } from '@/features/home/HomeScreen';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

/**
 * Home tab — native Stack header with two right-side bar buttons:
 * profile (always the static `user-circle` glyph regardless of auth state) and
 * the kebab (⋯) settings entry. On iOS 26 each item gets its own Liquid Glass
 * capsule via `unstable_headerRightItems` (`sharesBackground: false`). Android
 * falls back to JSX `headerRight` with `HeaderIconButton`.
 */
export default function HomeTab() {
  useTabFocusTracking('home');
  const router = useRouter();
  const { t } = useT();

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          ...(Platform.OS === 'ios'
            ? {
                // Scroll-edge appearance: at scroll-top the bar is transparent
                // (콘텐츠와 한 면처럼 보임), once content scrolls under the bar
                // iOS auto-fades in `systemChromeMaterial` blur. iOS 26 layers
                // this on top of Liquid Glass for the bar background, while the
                // right-side capsule buttons stay distinct (sharesBackground:
                // false). Requires defeating the inherited opaque
                // `headerStyle.backgroundColor` from defaultHeaderOptions.
                headerBlurEffect: 'systemChromeMaterial',
                headerTransparent: true,
                headerStyle: { backgroundColor: 'transparent' },
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
      <HomeScreen />
    </>
  );
}
