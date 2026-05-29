/**
 * Floating search bar — tappable (not input), navigates to search screen.
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
      <View style={[styles.outer, glassStyles.shadow]} pointerEvents="box-none">
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
  outer: {
    flex: 1,
    borderRadius: 999,
  },
  glassSurface: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  fallbackContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    ...SdsShadows.elevated.legacy,
  },
  placeholder: {
    ...SdsTypo.t6,
    color: SdsColors.grey400,
    flex: 1,
  },
});

// Same intermediate shadow as RefreshFab Glass branch — Apple HIG floating
// element guidance, dialed below SdsShadows.elevated to avoid clashing with
// Glass specular. Promote to a `glassFloat` token if a third callsite shows up.
const glassStyles = StyleSheet.create({
  shadow: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
