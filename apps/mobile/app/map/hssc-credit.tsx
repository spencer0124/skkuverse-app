/**
 * HSSC Building Map Credit — info/credit page for the building map.
 *
 * Route: /map/hssc-credit
 * Flutter source: hssc_building_credit.dart
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SdsColors, SdsTypo } from '@skkuverse/shared';

export default function HSSCCreditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Navigation bar */}
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
        <View style={styles.iconButton} />
      </View>

      {/* Credit card */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            인사캠 건물지도 '빠를지도' 제공
          </Text>
          <View style={styles.cardSpacer} />
          <Text style={styles.cardBody}>
            @문화예술캡스톤디자인 2조{'\n'}김찬호 김서연 전윤아 왕희문 손주연
            신해령
          </Text>
        </View>
      </View>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  card: {
    backgroundColor: SdsColors.grey100,
    borderRadius: 10,
    padding: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  cardSpacer: {
    height: 3,
  },
  cardBody: {
    fontSize: 13,
    color: SdsColors.grey900,
    lineHeight: 20,
  },
});
