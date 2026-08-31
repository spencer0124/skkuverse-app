/**
 * Grabbing handle for the snapping bottom sheet — the bar and nothing else.
 *
 * It used to paint the sheet's white fill and its 20pt top corners. Both moved
 * to `SheetBackground`, which now owns the whole surface: on iOS 26 that
 * surface is Liquid Glass at the low detents, and a 22pt white strip sitting on
 * top of it would have been a visible lid across the card.
 *
 * `grey300` is left un-animated on purpose. It has to read against the glass
 * and against the opaque sheet, and it does — the map under the card is mostly
 * pale building footprints and parkland, so the bar keeps its contrast in both
 * states without a second interpolation to keep in sync.
 *
 * Flutter source: lib/features/campus_map/ui/snappingsheet/grabbing_box.dart
 */

import { View, StyleSheet } from 'react-native';
import { SdsColors } from '@skkuverse/shared';

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
