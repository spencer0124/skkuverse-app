/**
 * Reusable toggle pill for campus/layer selection.
 *
 * Selected: brand bg + brand border. Unselected: white bg + grey border.
 */

import { Pressable, Text, StyleSheet } from 'react-native';
import { SdsColors, SdsTypo, SdsRadius } from '@skkuuniverse/shared';

interface FilterPillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterPill({ label, selected, onPress }: FilterPillProps) {
  return (
    <Pressable
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: SdsRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SdsColors.grey200,
  },
  pillSelected: {
    backgroundColor: SdsColors.brand,
    borderColor: SdsColors.brand,
  },
  text: {
    ...SdsTypo.t7,
    color: SdsColors.grey600,
  },
  textSelected: {
    color: '#fff',
  },
});
