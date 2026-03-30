/**
 * Bus list row — renders a single transit list item.
 *
 * Ports `CustomRow1` from Flutter's busrow.dart. Layout:
 * - Pressable row: paddingH 20, paddingV 14
 * - Icon (28px) → gap(14) → Column(label row + subtitle) → Chevron(20px)
 * - Label + badge inline, subtitle below
 *
 * Flutter source: lib/features/transit/widgets/busrow.dart
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors, SdsTypo, type BusListItem, hexToColor } from '@skkuverse/shared';
import { BusIcon } from './BusIcon';

interface BusListItemRowProps {
  item: BusListItem;
  onPress: () => void;
}

export function BusListItemRow({ item, onPress }: BusListItemRowProps) {
  const { card } = item;
  const color = hexToColor(card.themeColor, SdsColors.brand);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={onPress}
      >
        <BusIcon iconType={card.iconType} size={28} />

        <View style={styles.content}>
          <View style={styles.labelRow}>
            <Text style={styles.label} numberOfLines={1}>
              {card.label}
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: color + '1F', // ~0.12 opacity
                  borderColor: color + '4D', // ~0.30 opacity
                },
              ]}
            >
              <Text style={[styles.badgeText, { color }]}>
                {card.busTypeText}
              </Text>
            </View>
          </View>

          {card.subtitle != null && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {card.subtitle}
            </Text>
          )}
        </View>

        <MaterialIcons
          name="chevron-right"
          size={20}
          color={SdsColors.grey400}
        />
      </Pressable>
      <View style={styles.divider} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  pressed: {
    backgroundColor: SdsColors.grey50,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '700',
    color: SdsColors.grey900,
    flexShrink: 1,
  },
  badge: {
    borderWidth: 0.5,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    color: SdsColors.grey500,
  },
  divider: {
    height: 0.5,
    backgroundColor: SdsColors.grey100,
    marginLeft: 20,
  },
});
