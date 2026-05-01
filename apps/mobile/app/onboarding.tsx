import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  return (
    <SafeAreaProvider>
      <OnboardingScreen />
    </SafeAreaProvider>
  );
}
