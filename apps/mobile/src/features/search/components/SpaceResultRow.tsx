/**
 * Space search result row — space name + building/floor + spaceCd.
 */

import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SdsColors,
  SdsTypo,
  SdsSpacing,
  type SearchSpaceItem,
  type SpaceGroup,
  getLocalizedText,
  useSettingsStore,
} from '@skkuuniverse/shared';

interface SpaceResultRowProps {
  space: SearchSpaceItem;
  group: SpaceGroup;
  onPress: () => void;
}

export function SpaceResultRow({ space, group, onPress }: SpaceResultRowProps) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const spaceName = getLocalizedText(space.name, lang);
  const buildingName = getLocalizedText(group.buildingName, lang);
  const floorLabel = getLocalizedText(space.floor, lang);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="location-outline" size={18} color={SdsColors.grey500} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {spaceName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {buildingName} · {floorLabel}
        </Text>
      </View>
      <Text style={styles.spaceCd}>{space.spaceCd}</Text>
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
    backgroundColor: SdsColors.grey50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    ...SdsTypo.t5,
    color: SdsColors.grey900,
  },
  sub: {
    ...SdsTypo.t7,
    color: SdsColors.grey500,
    marginTop: 2,
  },
  spaceCd: {
    ...SdsTypo.t7,
    color: SdsColors.grey400,
  },
});
