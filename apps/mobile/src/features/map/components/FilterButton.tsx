/**
 * Floating filter button — opens the FilterSheet.
 */

import { Pressable, StyleSheet } from 'react-native';
import { SlidersHorizontalIcon } from 'phosphor-react-native';
import { SdsColors, SdsShadows } from '@skkuverse/shared';
import { logCampusContentSelect } from '@/services/analytics';

interface FilterButtonProps {
  onPress: () => void;
}

export function FilterButton({ onPress }: FilterButtonProps) {
  return (
    <Pressable
      style={styles.button}
      onPress={() => {
        logCampusContentSelect({ content_type: 'filter_button', item_id: 'open' });
        onPress();
      }}
    >
      <SlidersHorizontalIcon size={20} color={SdsColors.grey700} />
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
