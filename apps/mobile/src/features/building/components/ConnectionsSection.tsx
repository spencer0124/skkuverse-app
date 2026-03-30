/**
 * Connected buildings section in building detail.
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SdsColors,
  SdsTypo,
  SdsSpacing,
  type BuildingConnection,
  getLocalizedText,
  useSettingsStore,
} from '@skkuverse/shared';

interface ConnectionsSectionProps {
  connections: BuildingConnection[];
  onConnectionTap: (targetSkkuId: number) => void;
}

export function ConnectionsSection({
  connections,
  onConnectionTap,
}: ConnectionsSectionProps) {
  const lang = useSettingsStore((s) => s.appLanguage);

  if (connections.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>연결 건물</Text>
      {connections.map((conn, index) => (
        <Pressable
          key={`${conn.targetSkkuId}-${index}`}
          style={styles.row}
          onPress={() => onConnectionTap(conn.targetSkkuId)}
        >
          <Ionicons
            name="git-branch-outline"
            size={16}
            color={SdsColors.grey500}
          />
          <View style={styles.info}>
            <Text style={styles.name}>
              {getLocalizedText(conn.targetName, lang)}
            </Text>
            <Text style={styles.floor}>
              {getLocalizedText(conn.fromFloor, lang)} →{' '}
              {getLocalizedText(conn.toFloor, lang)}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={SdsColors.grey300}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: SdsSpacing.base,
  },
  title: {
    ...SdsTypo.t5,
    fontWeight: '700',
    color: SdsColors.grey900,
    paddingHorizontal: SdsSpacing.base,
    marginBottom: SdsSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SdsSpacing.md,
    paddingHorizontal: SdsSpacing.base,
    gap: 10,
  },
  info: {
    flex: 1,
  },
  name: {
    ...SdsTypo.t6,
    color: SdsColors.grey800,
  },
  floor: {
    ...SdsTypo.t7,
    color: SdsColors.grey400,
    marginTop: 2,
  },
});
