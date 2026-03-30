/**
 * Floating campus toggle — 인사캠/자과캠 switch.
 *
 * Reads/writes from useMapLayerStore.selectedCampus.
 * Positioned absolutely below the search bar.
 */

import { View, StyleSheet } from 'react-native';
import { useMapLayerStore, type CampusDef, SdsShadows } from '@skkuverse/shared';
import { FilterPill } from './FilterPill';

interface CampusToggleProps {
  campuses: CampusDef[];
}

export function CampusToggle({ campuses }: CampusToggleProps) {
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
  const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);

  return (
    <View style={styles.container}>
      {campuses.map((campus) => (
        <FilterPill
          key={campus.id}
          label={campus.label}
          selected={campus.id === selectedCampus}
          onPress={() => setSelectedCampus(campus.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    ...SdsShadows.elevated.legacy,
  },
});
