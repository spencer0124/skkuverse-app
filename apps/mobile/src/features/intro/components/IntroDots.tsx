import { StyleSheet, View } from 'react-native';

import { previewBrand } from '@/components/previews';

interface Props {
  count: number;
  activeIndex: number;
}

/**
 * Page indicator for the intro pager.
 *
 * A row of dots rather than the SDS ProgressBar: the intro is a tour a user can
 * swipe both ways, and a filling bar reads as irreversible progress through a
 * form. The active dot widens instead of only changing colour so the position
 * survives a colour-blind read.
 */
export function IntroDots({ count, activeIndex }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.dot, index === activeIndex && styles.dotActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
  },
  dotActive: {
    width: 18,
    backgroundColor: previewBrand.green,
  },
});
