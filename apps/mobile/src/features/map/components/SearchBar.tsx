/**
 * Floating search bar — tappable (not input), navigates to search screen.
 *
 * Flutter source: lib/features/campus_map/widgets/searchbar.dart
 */

import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SdsColors, SdsTypo, SdsShadows } from '@skkuuniverse/shared';

export function SearchBar() {
  const router = useRouter();

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push('/search')}
    >
      <Ionicons name="search" size={18} color={SdsColors.grey500} />
      <Text style={styles.placeholder}>건물, 강의실 검색</Text>
      <View style={styles.spacer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
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
  spacer: {
    width: 18,
  },
});
