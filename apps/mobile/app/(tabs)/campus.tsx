/**
 * Campus tab — Naver Map + snapping bottom sheet with SDUI content.
 *
 * Phase 6: Replaced fullscreen SDUI ScrollView with map composition.
 * The CampusScreen component handles all map/sheet/search integration.
 *
 * Flutter source: lib/features/campus_map/ui/campus_map_tab.dart
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { CampusScreen } from '@/features/map/CampusScreen';

export default function CampusTab() {
  return (
    <>
      <CampusScreen />
      <Pressable
        style={debugBtnStyle.btn}
        onPress={() => router.push('/debug-fcm' as never)}
      >
        <Text style={debugBtnStyle.txt}>FCM</Text>
      </Pressable>
    </>
  );
}

/**
 * Persistent FCM debug entry — intentionally NOT __DEV__-gated so it ships
 * in TestFlight builds. Remove only when Phase 3 is stable.
 */
const debugBtnStyle = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#f85149',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 9999,
  },
  txt: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
