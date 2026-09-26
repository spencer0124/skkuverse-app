import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ProfileSetupScreen } from '@/features/profile/ProfileSetupScreen';

/**
 * `/profile-setup` — fills in the player profile. `?nickname=1` asks for the
 * leaderboard nickname as well. A fullScreenModal, so it carries its own
 * SafeAreaProvider (docs/explanation/ios-modal-safe-area-provider.md).
 */
export default function ProfileSetupRoute() {
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  return (
    <SafeAreaProvider>
      <ProfileSetupScreen requireNickname={nickname === '1'} />
    </SafeAreaProvider>
  );
}
