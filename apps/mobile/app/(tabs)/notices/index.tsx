import { Stack, useRouter } from 'expo-router';
import { useAuthStore, useSettingsStore } from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { OnboardingLanding } from '@/features/notices/components/OnboardingLanding';
import { NoticesHeader } from '@/features/notices/components/NoticesHeader';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

// Custom 2-row header replaces native Stack header so the 9-tab fluid Tab
// control lives OUTSIDE the screen body view tree. The body itself is built
// to keep the SectionList as RNSScreen subviews[0] so iOS 26 NativeTabs
// `tabBarMinimizeBehavior` discovers it via the strict subviews[0] chain.
//
// Trade-off: native iOS 26 Liquid Glass per-button capsules
// (unstable_headerLeftItems / unstable_headerRightItems with
// sharesBackground:false) are NOT reproducible in a React-rendered header.
// NoticesHeader uses plain Pressable touch areas. Acceptable cost for the
// minimize-on-scroll fix.
export default function NoticesTab() {
  useTabFocusTracking('notices');
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  const screenOptions = (
    <Stack.Screen
      options={{
        header: () => <NoticesHeader />,
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
