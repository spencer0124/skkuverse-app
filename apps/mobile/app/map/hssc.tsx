/**
 * HSSC Building Map — native SVG render.
 *
 * Route: /map/hssc
 * Params: ?building=건물명 (optional, centers map on that building)
 */

import { View, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { InfoIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { HsscMapScreen } from '@/features/map/hssc/HsscMapScreen';
import { HeaderIconButton } from '@/lib/HeaderIconButton';

export default function HSSCMapRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              onPress={() => router.push('/map/hssc-credit' as never)}
            >
              <InfoIcon size={22} color={SdsColors.grey900} />
            </HeaderIconButton>
          ),
        }}
      />
      <HsscMapScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
});
