/**
 * Filter bottom sheet — the full filter surface.
 *
 * Two data sources with two lifetimes, deliberately kept apart: the campus and
 * base-layer pills come from `/map/config` and are permanent, while the event
 * sections come from the snapshot and vanish with the event. They share a sheet
 * because they answer the same user question ("what is on my map"), not because
 * they are the same kind of thing.
 *
 * Every chip group lives here, including the ones `EventMapChipRow` also shows.
 * That is not duplication: the row carries the unlabelled groups as one-tap
 * toggles, and this is where a group with a heading can actually have one.
 *
 * No sort control. Sort is only observable in the list, so a selector here would
 * be a control that appears to do nothing — see `EventMapListSheet`.
 */

import { forwardRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  useEventMapStore,
  useMapLayerStore,
  useT,
  type Campus,
  type EventMapSnapshot,
  type MapConfig,
  SdsColors,
  SdsTypo,
  SdsSpacing,
} from '@skkuverse/shared';
import { FilterPill } from './FilterPill';
import { logCampusContentSelect, logLayerToggle } from '@/services/analytics';

interface FilterSheetProps {
  mapConfig: MapConfig;
  /** `null` when no event is running — the event sections then do not render. */
  eventSnapshot: EventMapSnapshot | null;
}

export const FilterSheet = forwardRef<BottomSheetModal, FilterSheetProps>(
  function FilterSheet({ mapConfig, eventSnapshot }, ref) {
    const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
    const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);
    const layers = useMapLayerStore((s) => s.layers);
    const toggleLayer = useMapLayerStore((s) => s.toggleLayer);

    const selectedChips = useEventMapStore((s) => s.selectedChips);
    const toggleChip = useEventMapStore((s) => s.toggleChip);
    const clearChips = useEventMapStore((s) => s.clearChips);

    const handleCampusPress = useCallback(
      (campusId: Campus) => {
        setSelectedCampus(campusId);
      },
      [setSelectedCampus],
    );

    const { t } = useT();

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['55%', '85%']}
        enableDynamicSizing={false}
        handleIndicatorStyle={styles.handleIndicator}
        // It can now be opened while the peek sheet is up, and the default
        // 'switch' would minimise that sheet and resurface it on close.
        stackBehavior="replace"
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
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

          {eventSnapshot && eventSnapshot.chipGroups.length > 0 ? (
            <>
              <View style={[styles.eventHeader, styles.sectionMargin]}>
                <Text style={styles.sectionTitle}>{t('eventmap.filter.section')}</Text>
                <Pressable
                  onPress={() => clearChips(eventSnapshot)}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.reset}>{t('eventmap.filter.reset')}</Text>
                </Pressable>
              </View>

              {eventSnapshot.chipGroups.map((group) => (
                <View key={group.id} style={styles.group}>
                  {group.label ? <Text style={styles.groupLabel}>{group.label}</Text> : null}
                  <View style={styles.pillRow}>
                    {group.chips.map((chip) => (
                      <FilterPill
                        key={chip.id}
                        label={chip.label}
                        selected={(selectedChips[group.id] ?? []).includes(chip.id)}
                        onPress={() => {
                          logCampusContentSelect({
                            content_type: 'eventmap_filter_chip',
                            item_id: chip.id,
                          });
                          toggleChip(group.id, chip.id, group.selection);
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    padding: SdsSpacing.base,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
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
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reset: {
    ...SdsTypo.t7,
    fontWeight: '600',
    color: SdsColors.grey600,
    marginBottom: SdsSpacing.sm,
  },
  group: {
    marginTop: SdsSpacing.md,
  },
  groupLabel: {
    ...SdsTypo.t7,
    fontWeight: '600',
    color: SdsColors.grey600,
    marginBottom: 6,
  },
  handleIndicator: {
    backgroundColor: SdsColors.grey300,
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
