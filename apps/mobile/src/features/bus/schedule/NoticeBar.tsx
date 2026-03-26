/**
 * Notice bar — info (blue) or warning (orange) strip with text.
 *
 * Flutter source: bus_campus_screen.dart (notice banner, lines 426-468)
 *
 * Key difference from Flutter: text color matches icon color (not grey).
 */

import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsTypo, SdsRadius, type ScheduleNotice } from '@skkuuniverse/shared';

interface NoticeBarProps {
  notice: ScheduleNotice;
}

/** Flutter notice style configs (exact hex values from bus_campus_screen.dart) */
const STYLE_CONFIG: Record<string, { bg: string; icon: string; color: string }> = {
  warning: { bg: '#FFF3E0', icon: 'warning-amber', color: '#E65100' },
  info: { bg: '#E3F2FD', icon: 'info-outline', color: '#1565C0' },
};

export function NoticeBar({ notice }: NoticeBarProps) {
  const config = STYLE_CONFIG[notice.style] ?? STYLE_CONFIG.info;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <MaterialIcons
        name={config.icon as keyof typeof MaterialIcons.glyphMap}
        size={16}
        color={config.color}
      />
      <Text style={[styles.text, { color: config.color }]}>{notice.text}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: SdsRadius.sm,
  },
  text: {
    flex: 1,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: '500',
  },
});
