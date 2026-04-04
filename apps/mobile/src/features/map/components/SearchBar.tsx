/**
 * Floating search bar — tappable (not input), navigates to search screen.
 *
 * Flutter source: lib/features/campus_map/widgets/searchbar.dart
 */

import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { SdsColors, SdsTypo, SdsShadows, useT } from '@skkuverse/shared';

export function SearchBar() {
  const router = useRouter();
  const { t } = useT();

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push('/search')}
    >
      <Search size={18} color={SdsColors.grey500} />
      <Text style={styles.placeholder} numberOfLines={1} ellipsizeMode="tail">{t('search.placeholder')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
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
