import { View, StyleSheet } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { NoticeSummaryType } from '@skkuverse/shared';

interface Props {
  type: NoticeSummaryType;
}

const COLORS: Record<NoticeSummaryType, { bg: string; fg: string; labelKey: 'notices.filterAction' | 'notices.filterEvent' | 'notices.filterInfo' }> = {
  action_required: { bg: SdsColors.red50, fg: SdsColors.red500, labelKey: 'notices.filterAction' },
  event: { bg: SdsColors.blue50, fg: SdsColors.blue500, labelKey: 'notices.filterEvent' },
  informational: { bg: SdsColors.grey100, fg: SdsColors.grey700, labelKey: 'notices.filterInfo' },
};

export function SummaryBadge({ type }: Props) {
  const { t } = useT();
  const c = COLORS[type];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Txt typography="t7" fontWeight="semibold" color={c.fg}>
        {t(c.labelKey)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
});
