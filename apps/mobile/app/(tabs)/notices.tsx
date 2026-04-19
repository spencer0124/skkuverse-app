import { useRouter } from 'expo-router';
import { useAuthStore, useSettingsStore } from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { OnboardingLanding } from '@/features/notices/components/OnboardingLanding';

export default function NoticesTab() {
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const router = useRouter();

  if (isAnonymous || !onboardingCompleted) {
    return (
      <OnboardingLanding
        onStartPress={() => router.push('/onboarding')}
      />
    );
  }

  return <NoticesTabScreen />;
}
