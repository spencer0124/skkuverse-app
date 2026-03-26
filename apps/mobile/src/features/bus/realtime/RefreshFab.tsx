/**
 * Refresh FAB — floating action button for manual data refresh.
 *
 * Flutter source: bus_realtime_screen.dart (refresh FAB)
 */

import { Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors, SdsShadows } from '@skkuuniverse/shared';

interface RefreshFabProps {
  color: string;
  onPress: () => void;
}

export function RefreshFab({ color, onPress }: RefreshFabProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: color, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <MaterialIcons name="refresh" size={24} color={SdsColors.background} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...SdsShadows.elevated,
  },
});
