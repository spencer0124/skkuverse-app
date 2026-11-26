import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ListHeader, createThemedStyles } from '@skkuverse/sds';
import type { NoticeScheduleItem } from '../notice-schedule.types';
import { NoticeScheduleRow } from './NoticeScheduleRow';
import { useNoticeScheduleSection, type NoticeScheduleMapTarget } from './useNoticeScheduleSection';

interface Props {
  schedule: readonly NoticeScheduleItem[];
  now: Date;
  onMapPress: (target: NoticeScheduleMapTarget) => void;
}

export function NoticeScheduleSection({ schedule, now, onMapPress }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const { rows, onToggle } = useNoticeScheduleSection({ schedule, now });

  return (
    <View>
      <ListHeader
        style={styles.header}
        title={
          <ListHeader.TitleParagraph typography="t9" fontWeight="bold">
            {t('notices.schedule.title')}
          </ListHeader.TitleParagraph>
        }
      />
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
  header: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x8,
    paddingBottom: SdsSpacing.x3,
  },
}));
