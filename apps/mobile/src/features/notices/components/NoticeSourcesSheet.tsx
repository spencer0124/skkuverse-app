import { StyleSheet, View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Button, ListRow, Sheet, Txt, useSheetBottomInset } from '@skkuverse/sds';
import { toPostedMonthDay } from '../notice-brief.rules';
import type { NoticeBriefSource } from '../notice-brief.types';

interface Props {
  open: boolean;
  title: string;
  source: NoticeBriefSource;
  onRowPress: () => void;
  onClose: () => void;
  onDismiss: () => void;
}

export function NoticeSourcesSheet({ open, title, source, onRowPress, onClose, onDismiss }: Props) {
  const { t, tpl } = useT();
  const bottomInset = useSheetBottomInset();
  const day = toPostedMonthDay(source.postedAt);
  const meta = [source.boardName, day ? tpl('notices.brief.sourceDate', day.month, day.day) : null]
    .filter((part) => part)
    .join(' · ');

  return (
    <Sheet
      open={open}
      position={{ kind: 'fit' }}
      backdrop
      onDismiss={onDismiss}
      accessibility={{ label: t('notices.brief.sourcesTitle') }}
    >
      <Sheet.View style={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD + bottomInset }]}>
        <Txt typography="t10" fontWeight="bold" color="neutral" style={styles.title}>
          {t('notices.brief.sourcesTitle')}
        </Txt>
        <ListRow
          onPress={onRowPress}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${meta}`}
          verticalPadding="small"
          contents={
            <ListRow.Texts
              layout="2RowTypeB"
              top={title}
              topProps={{ numberOfLines: 1 }}
              bottom={meta}
            />
          }
          withArrow
        />
        <View style={styles.actions}>
          <Button tone="neutral" variant="weak" size="large" display="block" onPress={onClose}>
            {t('common.close')}
          </Button>
        </View>
      </Sheet.View>
    </Sheet>
  );
}

const CONTENT_BOTTOM_PAD = 24;

const styles = StyleSheet.create({
  content: {
    paddingTop: SdsSpacing.x5,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: {
    paddingHorizontal: SdsSpacing.x6,
    paddingBottom: SdsSpacing.x2,
  },
  actions: {
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x4,
  },
});
