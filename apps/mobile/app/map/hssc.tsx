/**
 * HSSC Building Map — native SVG render.
 *
 * Route: /map/hssc
 * Params: ?building=건물명 (optional, centers map on that building)
 */

import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Info } from 'lucide-react-native';
import { SdsColors, SdsTypo } from '@skkuverse/shared';
import { HsscMapScreen } from '@/features/map/hssc/HsscMapScreen';

export default function HSSCMapRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={8}
        >
          <ArrowLeft size={24} color={SdsColors.grey900} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          인사캠 건물지도
        </Text>
        <Pressable
          onPress={() => router.push('/map/hssc-credit' as never)}
          style={styles.iconButton}
          hitSlop={8}
        >
          <Info size={24} color={SdsColors.grey900} />
        </Pressable>
      </View>

      <HsscMapScreen />

      {/* Bottom ad banner space */}
      <View style={{ height: 50 + insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
});
