/**
 * Floating filter button — opens the FilterSheet.
 */

import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SdsColors, SdsShadows } from '@skkuuniverse/shared';

interface FilterButtonProps {
  onPress: () => void;
}

export function FilterButton({ onPress }: FilterButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Ionicons name="options-outline" size={20} color={SdsColors.grey700} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SdsShadows.elevated.legacy,
  },
});
