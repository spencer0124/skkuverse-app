/**
 * Floor accordion tile — expands to show spaces.
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SdsColors,
  SdsTypo,
  SdsSpacing,
  type FloorInfo,
  getLocalizedText,
  useSettingsStore,
} from '@skkuuniverse/shared';

interface FloorTileProps {
  floor: FloorInfo;
  highlightSpaceCd?: string;
}

export function FloorTile({ floor, highlightSpaceCd }: FloorTileProps) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const [expanded, setExpanded] = useState(
    // Auto-expand if a space in this floor is highlighted
    highlightSpaceCd
      ? floor.spaces.some((s) => s.spaceCd === highlightSpaceCd)
      : false,
  );

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const floorLabel = getLocalizedText(floor.floor, lang);

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={toggle}>
        <Text style={styles.floorLabel}>{floorLabel}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{floor.spaces.length}개</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={SdsColors.grey400}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.spaceList}>
          {floor.spaces.map((space) => {
            const isHighlight = space.spaceCd === highlightSpaceCd;
            return (
              <View
                key={space.spaceCd}
                style={[styles.spaceRow, isHighlight && styles.spaceHighlight]}
              >
                <Text style={styles.spaceName}>
                  {getLocalizedText(space.name, lang)}
                </Text>
                <Text style={styles.spaceCd}>{space.spaceCd}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: SdsColors.grey100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SdsSpacing.md,
    paddingHorizontal: SdsSpacing.base,
  },
  floorLabel: {
    ...SdsTypo.t5,
    fontWeight: '600',
    color: SdsColors.grey900,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    ...SdsTypo.t7,
    color: SdsColors.grey400,
  },
  spaceList: {
    paddingBottom: SdsSpacing.sm,
  },
  spaceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: SdsSpacing.base,
    marginHorizontal: SdsSpacing.sm,
    borderRadius: 6,
  },
  spaceHighlight: {
    backgroundColor: SdsColors.brand + '14', // 8% opacity
  },
  spaceName: {
    ...SdsTypo.t6,
    color: SdsColors.grey800,
    flex: 1,
  },
  spaceCd: {
    ...SdsTypo.t7,
    color: SdsColors.grey400,
    marginLeft: 8,
  },
});
