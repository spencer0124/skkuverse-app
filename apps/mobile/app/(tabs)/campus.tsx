/**
 * Campus tab — Naver Map + snapping bottom sheet with SDUI content.
 *
 * Phase 6: Replaced fullscreen SDUI ScrollView with map composition.
 * The CampusScreen component handles all map/sheet/search integration.
 *
 * Flutter source: lib/features/campus_map/ui/campus_map_tab.dart
 */

import { CampusScreen } from '@/features/map/CampusScreen';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function CampusTab() {
  const router = useRouter();
  return (
    <>
      <CampusScreen />
      {/* {__DEV__ && (
        <Pressable
          style={styles.devFab}
          onPress={() => router.push('/sds-preview')}
        >
          <Text style={styles.devFabText}>SDS</Text>
        </Pressable>
      )} */}
    </>
  );
}

const styles = StyleSheet.create({
  devFab: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  devFabText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
