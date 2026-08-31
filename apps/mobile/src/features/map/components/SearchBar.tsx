/**
 * Search bar — tappable (not input), navigates to search screen.
 *
 * Lives inside the campus bottom sheet, not floating over the map. It sizes
 * itself to `MAP_CONTROL_HEIGHT` even so: the campus toggle took its place in
 * the floating row and has to match it, and pinning both to one constant is
 * what makes "the same size" a fact rather than two paddings that happen to
 * agree today.
 *
 * iOS 26+: native UIGlassEffect via expo-glass-effect (`GlassView`).
 * iOS<26 / Android: existing solid white capsule (no visual change).
 *
 * Flutter source: lib/features/campus_map/widgets/searchbar.dart
 */

import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsColors, SdsTypo, SdsShadows, useT } from '@skkuverse/shared';
import { glassFloatShadow } from '@skkuverse/sds';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';
import { logCampusContentSelect } from '@/services/analytics';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

export function SearchBar() {
  const router = useRouter();
  const { t } = useT();

  const handlePress = () => {
    logCampusContentSelect({ content_type: 'search_bar', item_id: 'open' });
    router.push('/search');
  };

  if (GLASS_AVAILABLE) {
    return (
      <View style={[styles.outer, glassFloatShadow]} pointerEvents="box-none">
        <GlassView style={styles.glassSurface} glassEffectStyle="regular" isInteractive>
          <Pressable
            style={({ pressed }) => [
              styles.content,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={handlePress}
          >
            <MagnifyingGlassIcon size={18} color={SdsColors.grey500} />
            <Text style={styles.placeholder} numberOfLines={1} ellipsizeMode="tail">
              {t('search.placeholder')}
            </Text>
          </Pressable>
        </GlassView>
      </View>
    );
  }

  return (
    <Pressable style={styles.fallbackContainer} onPress={handlePress}>
      <MagnifyingGlassIcon size={18} color={SdsColors.grey500} />
      <Text style={styles.placeholder} numberOfLines={1} ellipsizeMode="tail">
        {t('search.placeholder')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `alignSelf: 'stretch'` rather than `flex: 1`: this now sits in a column
  // (the sheet), where `flex: 1` would stretch it to the sheet's full height
  // instead of its full width.
  outer: {
    alignSelf: 'stretch',
    height: MAP_CONTROL_HEIGHT,
    borderRadius: 999,
  },
  glassSurface: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  // Fills the fixed height instead of defining it with vertical padding, so the
  // capsule measures exactly `MAP_CONTROL_HEIGHT` whatever the font metrics do.
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  fallbackContainer: {
    alignSelf: 'stretch',
    height: MAP_CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    gap: 8,
    ...SdsShadows.elevated.legacy,
  },
  placeholder: {
    ...SdsTypo.t6,
    color: SdsColors.grey400,
    flex: 1,
  },
});
