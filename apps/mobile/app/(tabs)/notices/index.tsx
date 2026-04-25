import { Stack, useRouter } from 'expo-router';
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
        title: t('nav.notices'),
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
