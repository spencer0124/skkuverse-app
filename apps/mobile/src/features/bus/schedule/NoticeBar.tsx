/**
 * Notice bar — info (blue) or warning (yellow) strip with text.
 *
 * Flutter source: bus_campus_screen.dart (notice banner)
 */

import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors, SdsTypo, SdsRadius, type ScheduleNotice } from '@skkuuniverse/shared';

interface NoticeBarProps {
  notice: ScheduleNotice;
}

const STYLE_CONFIG: Record<string, { bg: string; icon: string; iconColor: string }> = {
  info: { bg: SdsColors.blue50, icon: 'info-outline', iconColor: SdsColors.blue500 },
  warning: { bg: SdsColors.yellow50, icon: 'warning-amber', iconColor: SdsColors.orange500 },
};

export function NoticeBar({ notice }: NoticeBarProps) {
  const config = STYLE_CONFIG[notice.style] ?? STYLE_CONFIG.info;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <MaterialIcons
        name={config.icon as keyof typeof MaterialIcons.glyphMap}
        size={16}
        color={config.iconColor}
      />
      <Text style={styles.text}>{notice.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SdsRadius.sm,
  },
  text: {
    flex: 1,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    color: SdsColors.grey700,
  },
});
