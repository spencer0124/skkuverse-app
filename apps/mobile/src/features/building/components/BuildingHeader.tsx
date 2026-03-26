/**
 * Building detail header — name + campus badge + displayNo.
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  SdsColors,
  SdsTypo,
  SdsSpacing,
  type Building,
  getLocalizedText,
  useSettingsStore,
} from '@skkuuniverse/shared';

interface BuildingHeaderProps {
  building: Building;
}

export function BuildingHeader({ building }: BuildingHeaderProps) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const name = getLocalizedText(building.name, lang);

  return (
    <View>
      {building.image && (
        <Image
          source={{
            uri: building.image.url,
            headers: { Referer: 'https://www.skku.edu/' },
          }}
          style={styles.image}
          contentFit="cover"
        />
      )}
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.badges}>
          <View style={styles.campusBadge}>
            <Text style={styles.campusBadgeText}>{building.campusLabel}</Text>
          </View>
          {building.displayNo && (
            <Text style={styles.displayNo}>{building.displayNo}</Text>
          )}
        </View>
        {building.accessibility && (building.accessibility.elevator || building.accessibility.toilet) && (
          <View style={styles.accessRow}>
            {building.accessibility.elevator && (
              <View style={styles.accessBadge}>
                <Text style={styles.accessText}>엘리베이터</Text>
              </View>
            )}
            {building.accessibility.toilet && (
              <View style={styles.accessBadge}>
                <Text style={styles.accessText}>장애인화장실</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 180,
    backgroundColor: SdsColors.grey100,
  },
  header: {
    padding: SdsSpacing.base,
  },
  name: {
    ...SdsTypo.t3,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  campusBadge: {
    backgroundColor: SdsColors.brand,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  campusBadgeText: {
    ...SdsTypo.t7,
    color: '#fff',
    fontWeight: '600',
  },
  displayNo: {
    ...SdsTypo.t6,
    color: SdsColors.grey500,
  },
  accessRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SdsSpacing.sm,
  },
  accessBadge: {
    backgroundColor: SdsColors.blue500 + '1A', // 10% opacity
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  accessText: {
    ...SdsTypo.t7,
    color: SdsColors.blue500,
  },
});
