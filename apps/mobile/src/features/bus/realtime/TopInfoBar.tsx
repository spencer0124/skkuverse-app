/**
 * Top info bar — shows current time and running bus count.
 *
 * Flutter source: bus_realtime_screen.dart (infoBar widget)
 */

import { View, Text, StyleSheet } from 'react-native';
import { SdsColors, SdsTypo } from '@skkuverse/shared';

interface TopInfoBarProps {
  currentTime: string;
  totalBuses: number;
}

export function TopInfoBar({ currentTime, totalBuses }: TopInfoBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {currentTime} 기준 · {totalBuses}대 운행 중
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SdsColors.grey50,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  text: {
    fontSize: SdsTypo.sub12.fontSize,
    lineHeight: SdsTypo.sub12.lineHeight,
    color: SdsColors.grey700,
  },
});
