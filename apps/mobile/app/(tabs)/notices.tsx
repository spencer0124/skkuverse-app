import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { BellIcon, BellSlashIcon } from 'phosphor-react-native';
import {
  SdsColors,
  useAuthStore,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { OnboardingLanding } from '@/features/notices/components/OnboardingLanding';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

export default function NoticesTab() {
  useTabFocusTracking('notices');
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useT();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const noticesCategoryEnabled = useNotificationStore(
    (s) => s.preferences.categoryEnabled?.notices ?? false,
  );

  // Dynamic header — title + BellIcon/BellSlashIcon (toggles category state).
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('nav.notices'),
        headerShown: true,
        headerRight: () => (
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
        ),
      });
    }, [navigation, router, t, noticesCategoryEnabled]),
  );

  if (isAnonymous || !onboardingCompleted) {
    return (
      <OnboardingLanding
        onStartPress={() => router.push('/onboarding')}
      />
    );
  }

  return <NoticesTabScreen />;
}
