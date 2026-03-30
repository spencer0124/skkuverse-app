/**
 * License plate — bus number display. "0000" → "번호 없음".
 *
 * Flutter source: lib/features/transit/widgets/businfo_component.dart
 */

import { View, Text, StyleSheet } from 'react-native';
import { SdsColors } from '@skkuverse/shared';

interface LicensePlateProps {
  carNumber: string;
  color: string;
}

export function LicensePlate({ carNumber, color }: LicensePlateProps) {
  const displayNumber = carNumber === '0000' ? '번호 없음' : carNumber;

  return (
    <View style={[styles.plate, { backgroundColor: color }]}>
      <Text style={styles.text}>{displayNumber}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 42,
    alignItems: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    color: SdsColors.background,
  },
});
