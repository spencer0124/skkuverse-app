/**
 * Building search result row — icon + name + campus badge + displayNo.
 */

import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SdsColors,
  SdsTypo,
  SdsSpacing,
  type Building,
  getLocalizedText,
  useSettingsStore,
} from '@skkuuniverse/shared';

interface BuildingResultRowProps {
  building: Building;
  onPress: () => void;
}

export function BuildingResultRow({ building, onPress }: BuildingResultRowProps) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const name = getLocalizedText(building.name, lang);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="business-outline" size={20} color={SdsColors.grey500} />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {building.displayNo && (
            <Text style={styles.displayNo}>{building.displayNo}</Text>
          )}
        </View>
        <Text style={styles.campus}>{building.campusLabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={SdsColors.grey300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SdsSpacing.md,
    paddingHorizontal: SdsSpacing.base,
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...SdsTypo.t5,
    color: SdsColors.grey900,
    flexShrink: 1,
  },
  displayNo: {
    ...SdsTypo.t7,
    color: SdsColors.grey400,
  },
  campus: {
    ...SdsTypo.t7,
    color: SdsColors.grey500,
    marginTop: 2,
  },
});
