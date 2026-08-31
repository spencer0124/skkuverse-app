/**
 * Floating layers button — opens the FilterSheet.
 *
 * A layer stack rather than the sliders glyph it used to carry: what the sheet
 * behind it holds is a campus picker and a set of map layers, and a stack is
 * what every map app draws for that. Sliders promise numeric ranges to tune,
 * which is not what is in there.
 *
 * No count badge. It used to show how many layers were hidden, as a "you have
 * narrowed this" signal — but a chip narrowing is already named by the strip
 * that replaces the chip row, and a number beside it was a second, vaguer
 * copy of the same fact. What the sheet behind this button shows is the state
 * itself.
 *
 * Glass on iOS 26 so it reads as one control set with the campus toggle beside
 * it — the two sit in the same floating row, and a solid white circle next to
 * a `GlassView` capsule is visibly two design languages.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { StackSimpleIcon } from 'phosphor-react-native';
import { SdsColors, SdsShadows } from '@skkuverse/shared';
import { GlassSurface, GLASS_AVAILABLE, glassFloatShadow } from '@skkuverse/sds';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';
import { logCampusContentSelect } from '@/services/analytics';

interface FilterButtonProps {
  onPress: () => void;
}

export function FilterButton({ onPress }: FilterButtonProps) {
  const body = (
    <Pressable
      style={styles.pressable}
      accessibilityRole="button"
      onPress={() => {
        logCampusContentSelect({ content_type: 'filter_button', item_id: 'open' });
        onPress();
      }}
    >
      <StackSimpleIcon size={20} color={SdsColors.grey700} />
    </Pressable>
  );

  if (GLASS_AVAILABLE) {
    return (
      <View style={[styles.outer, glassFloatShadow]}>
        <GlassSurface interactive style={styles.glassSurface}>
          {body}
        </GlassSurface>
      </View>
    );
  }
  return <View style={[styles.outer, styles.fallback]}>{body}</View>;
}

// A circle, so its diameter is also the row's height — shared with the campus
// toggle beside it rather than restated here.
const SIZE = MAP_CONTROL_HEIGHT;

const styles = StyleSheet.create({
  outer: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  glassSurface: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' },
  fallback: {
    backgroundColor: '#fff',
    ...SdsShadows.elevated.legacy,
  },
  pressable: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
