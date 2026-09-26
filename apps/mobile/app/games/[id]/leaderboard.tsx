import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { LeaderboardScreen } from '@/features/games/leaderboard/LeaderboardScreen';
import { isNativeGameId } from '@/features/games/ids';

/** `/games/<id>/leaderboard` — a transparent modal over the game or home, with its own SafeAreaProvider. */
export default function LeaderboardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id || !isNativeGameId(id)) return <Redirect href="/(tabs)/home" />;
  return (
    <SafeAreaProvider>
      <LeaderboardScreen gameId={id} />
    </SafeAreaProvider>
  );
}
