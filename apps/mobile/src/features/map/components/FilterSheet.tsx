/**
 * Filter bottom sheet — campus selection + layer toggles.
 *
 * Config-driven: iterates mapConfig.layers for toggle pills.
 */

import { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import {
  useMapLayerStore,
  useT,
  type MapConfig,
  SdsColors,
  SdsTypo,
  SdsSpacing,
} from '@skkuverse/shared';
import { FilterPill } from './FilterPill';
import { logLayerToggle } from '@/services/analytics';

interface FilterSheetProps {
  mapConfig: MapConfig;
}

export const FilterSheet = forwardRef<BottomSheetModal, FilterSheetProps>(
  function FilterSheet({ mapConfig }, ref) {
    const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
    const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);
    const layers = useMapLayerStore((s) => s.layers);
    const toggleLayer = useMapLayerStore((s) => s.toggleLayer);

    const handleCampusPress = useCallback(
      (campusId: string) => {
        setSelectedCampus(campusId);
      },
      [setSelectedCampus],
    );

    const { t } = useT();

    return (
      <BottomSheetModal ref={ref} snapPoints={['40%']} enableDynamicSizing={false}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.sectionTitle}>{t('filter.campus')}</Text>
          <View style={styles.pillRow}>
            {mapConfig.campuses.map((campus) => (
              <FilterPill
                key={campus.id}
                label={campus.label}
                selected={campus.id === selectedCampus}
                onPress={() => handleCampusPress(campus.id)}
              />
            ))}
          </View>

          <Text style={[styles.sectionTitle, styles.sectionMargin]}>
            {t('filter.layer')}
          </Text>
          <View style={styles.pillRow}>
            {mapConfig.layers.map((layer) => (
              <FilterPill
                key={layer.id}
                label={layer.label}
                selected={layers[layer.id]?.visible ?? false}
                onPress={() => {
                  const newVisible = !(layers[layer.id]?.visible ?? false);
                  toggleLayer(layer.id);
                  logLayerToggle(layer.id, newVisible);
                }}
              />
            ))}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    padding: SdsSpacing.base,
    paddingBottom: 40,
  },
  sectionTitle: {
    ...SdsTypo.t5,
    fontWeight: '700',
    color: SdsColors.grey900,
    marginBottom: SdsSpacing.sm,
  },
  sectionMargin: {
    marginTop: SdsSpacing.lg,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
