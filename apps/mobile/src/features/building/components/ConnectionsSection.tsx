/**
 * Connected buildings section in building detail.
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { View, StyleSheet } from 'react-native';
import {
  SdsColors,
  type BuildingConnection,
  getLocalizedText,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { ListRow, Txt } from '@skkuverse/sds';

/** Extract sort-key from floor name: "지하 2층" → -2, "1층" → 1, "B1" → -1 */
function floorOrder(name: string): number {
  const krBasement = name.match(/지하\s*(\d+)/);
  if (krBasement) return -Number(krBasement[1]);
  const enBasement = name.match(/^B(\d+)$/i);
  if (enBasement) return -Number(enBasement[1]);
  const num = name.match(/(\d+)/);
  if (num) return Number(num[1]);
  return 0;
}

interface ConnectionsSectionProps {
  connections: BuildingConnection[];
  onConnectionTap: (targetSkkuId: number) => void;
}

export function ConnectionsSection({
  connections,
  onConnectionTap,
}: ConnectionsSectionProps) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const { t } = useT();

  if (connections.length === 0) return null;

  // Group connections by target building
  const grouped = new Map<number, BuildingConnection[]>();
  for (const conn of connections) {
    const list = grouped.get(conn.targetSkkuId) ?? [];
    list.push(conn);
    grouped.set(conn.targetSkkuId, list);
  }

  return (
    <View>
      {Array.from(grouped.entries()).map(([targetSkkuId, group]) => {
        const first = group[0];
        const floorDesc = [...group]
          .sort(
            (a, b) =>
              floorOrder(getLocalizedText(a.fromFloor, lang)) -
              floorOrder(getLocalizedText(b.fromFloor, lang)),
          )
          .map((c) => getLocalizedText(c.fromFloor, lang))
          .join(' · ');

        return (
          <ListRow
            key={targetSkkuId}
            left={
              <View style={styles.connIcon}>
                <Txt
                  typography="t7"
                  fontWeight="bold"
                  color={SdsColors.grey600}
                >
                  {first.targetDisplayNo ?? ''}
                </Txt>
              </View>
            }
            contents={
              <ListRow.Texts
                type="2RowTypeE"
                top={getLocalizedText(first.targetName, lang)}
                bottom={`${floorDesc} ${t('building.passageway')}`}
              />
            }
            withArrow
            verticalPadding="small"
            onPress={() => onConnectionTap(targetSkkuId)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  connIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
