/**
 * Floating filter button — opens the FilterSheet.
 */

import { Pressable, StyleSheet } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { SdsColors, SdsShadows } from '@skkuverse/shared';

interface FilterButtonProps {
  onPress: () => void;
}

export function FilterButton({ onPress }: FilterButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <SlidersHorizontal size={20} color={SdsColors.grey700} />
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
