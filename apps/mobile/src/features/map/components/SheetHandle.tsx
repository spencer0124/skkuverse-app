/**
 * Grabbing handle for the snapping bottom sheet.
 *
 * 22px height, 4x36px grey bar, rounded top corners (radius 20), white bg.
 *
 * Flutter source: lib/features/campus_map/ui/snappingsheet/grabbing_box.dart
 */

import { View, StyleSheet } from 'react-native';
import { SdsColors } from '@skkuuniverse/shared';

export function SheetHandle() {
  return (
    <View style={styles.container}>
      <View style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 22,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: 36,
    height: 4,
    borderRadius: 10,
    backgroundColor: SdsColors.grey300,
  },
});
