import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { GameScreen } from '@/features/games/host/GameScreen';
import { isNativeGameId } from '@/features/games/ids';

/**
 * `/games/<id>` — a game bundled with the app. A fullScreenModal, so it
 * carries its own SafeAreaProvider, and its own sheet provider: a sheet
 * portalled to the root provider would be drawn under this modal.
 */
export default function GameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id || !isNativeGameId(id)) return <Redirect href="/(tabs)/home" />;
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <GameScreen gameId={id} />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}
