/**
 * HSSC Building Map Credit — info/credit page for the building map.
 *
 * Route: /map/hssc-credit
 * Flutter source: hssc_building_credit.dart
 */

import { View, Text, StyleSheet } from 'react-native';
import { SdsColors } from '@skkuverse/shared';

export default function HSSCCreditScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            인사캠 건물지도 &apos;빠를지도&apos; 제공
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
