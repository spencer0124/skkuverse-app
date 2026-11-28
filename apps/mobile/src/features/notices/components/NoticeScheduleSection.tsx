import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';
import type { NoticeScheduleItem } from '../notice-schedule.types';
import { NoticeScheduleRow } from './NoticeScheduleRow';
import { useNoticeScheduleSection, type NoticeScheduleMapTarget } from './useNoticeScheduleSection';

interface Props {
  schedule: readonly NoticeScheduleItem[];
  now: Date;
  onMapPress: (target: NoticeScheduleMapTarget) => void;
  /** WHY: under the audience table the table's own bottom space is the gap, so the timeline adds none. */
  isJoinedAbove: boolean;
}

export function NoticeScheduleSection({ schedule, now, onMapPress, isJoinedAbove }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const { rows, onToggle } = useNoticeScheduleSection({ schedule, now });

  return (
    <View style={isJoinedAbove ? null : styles.wrap} accessibilityRole="list" accessibilityLabel={t('notices.schedule.title')}>
      {rows.map((row, index) => (
        <NoticeScheduleRow
          key={row.id}
          row={row}
          isFirst={index === 0}
          isLast={index === rows.length - 1}
          onToggle={onToggle}
          onMapPress={onMapPress}
        />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  wrap: {
    paddingTop: SdsSpacing.x6,
  },
}));
