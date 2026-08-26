/**
 * Floating filter button — opens the FilterSheet.
 *
 * `activeCount` is the whole reason the event chip row can stay small: rather
 * than repeating every group over the map, the map shows the one-tap toggles and
 * this badge says how many other axes are narrowing what the user sees. A state
 * signal, not a second copy of the control.
 *
 * Glass on iOS 26 so it reads as one control set with `SearchBar` beside it —
 * the two sit in the same floating row, and a solid white circle next to a
 * `GlassView` capsule is visibly two design languages.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SlidersHorizontalIcon } from 'phosphor-react-native';
import { SdsColors, SdsShadows } from '@skkuverse/shared';
import { GlassSurface, GLASS_AVAILABLE, glassFloatShadow } from '@/components/glass';
import { logCampusContentSelect } from '@/services/analytics';

interface FilterButtonProps {
  onPress: () => void;
  /** Number of active filter axes. `0` hides the badge. */
  activeCount?: number;
}

export function FilterButton({ onPress, activeCount = 0 }: FilterButtonProps) {
  const body = (
    <Pressable
      style={styles.pressable}
      accessibilityRole="button"
      onPress={() => {
        logCampusContentSelect({ content_type: 'filter_button', item_id: 'open' });
        onPress();
      }}
    >
      <SlidersHorizontalIcon size={20} color={SdsColors.grey700} />
      {activeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{String(activeCount)}</Text>
        </View>
      ) : null}
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

const SIZE = 40;

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
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: SdsColors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Below the SdsTypo scale on purpose: it bottoms out at t7 (body copy), and a
  // counter inside a 16pt circle is a numeral, not text to read.
  badgeText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
