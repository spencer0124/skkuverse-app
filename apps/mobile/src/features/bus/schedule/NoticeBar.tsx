/**
 * Notice bar — info (blue) or warning (orange) strip with text.
 *
 * Flutter source: bus_campus_screen.dart (notice banner, lines 426-468)
 *
 * Key difference from Flutter: text color matches icon color (not grey).
 */

import { View, StyleSheet } from 'react-native';
import { TriangleAlert, Info } from 'lucide-react-native';
import { SdsRadius, type ScheduleNotice } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface NoticeBarProps {
  notice: ScheduleNotice;
}

/** Flutter notice style configs (exact hex values from bus_campus_screen.dart) */
const STYLE_CONFIG: Record<string, { bg: string; color: string }> = {
  warning: { bg: '#FFF3E0', color: '#E65100' },
  info: { bg: '#E3F2FD', color: '#1565C0' },
};

export function NoticeBar({ notice }: NoticeBarProps) {
  const config = STYLE_CONFIG[notice.style] ?? STYLE_CONFIG.info;
  const IconComponent = notice.style === 'warning' ? TriangleAlert : Info;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <IconComponent size={16} color={config.color} />
      <Txt typography="t7" fontWeight="medium" color={config.color} style={{ flex: 1 }}>
        {notice.text}
      </Txt>
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
});
