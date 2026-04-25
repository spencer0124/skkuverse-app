import { Stack, useRouter } from 'expo-router';
import { GearIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { HomeScreen } from '@/features/home/HomeScreen';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

export default function HomeTab() {
  useTabFocusTracking('home');
  const router = useRouter();
  const { t } = useT();

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <HeaderIconButton
              onPress={() => router.push('/settings' as never)}
              accessibilityRole="button"
              accessibilityLabel={t('settings.title')}
            >
              <GearIcon size={22} color={SdsColors.grey800} />
            </HeaderIconButton>
          ),
        }}
      />
      <HomeScreen />
    </>
  );
}
