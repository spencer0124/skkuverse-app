import { Pressable, View, StyleSheet } from 'react-native';
import { Paperclip, Pencil } from 'lucide-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { Department, NoticeListItem } from '@skkuverse/shared';
import { SummaryBadge } from './SummaryBadge';

interface Props {
  item: NoticeListItem;
  dept?: Department;
  onPress: (item: NoticeListItem) => void;
}

export function NoticeRow({ item, dept, onPress }: Props) {
  const { t } = useT();

  const showCategory = dept?.hasCategory && item.category;
  const showAuthor = dept?.hasAuthor && item.author;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.metaTopRow}>
        {item.summary?.type ? <SummaryBadge type={item.summary.type} /> : null}
        {showCategory ? (
          <Txt typography="t7" color={SdsColors.grey500}>
            {item.category}
          </Txt>
        ) : null}
      </View>

      <Txt typography="t5" fontWeight="semibold" color={SdsColors.grey900} numberOfLines={2}>
        {item.title}
      </Txt>

      {item.summary?.oneLiner ? (
        <Txt typography="t7" color={SdsColors.grey600} numberOfLines={2} style={styles.summary}>
          {item.summary.oneLiner}
        </Txt>
      ) : null}

      <View style={styles.footerRow}>
        <Txt typography="t7" color={SdsColors.grey500}>
          {item.date}
        </Txt>
        {showAuthor ? (
          <>
            <Dot />
            <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
              {item.author}
            </Txt>
          </>
        ) : null}
        {item.hasAttachments ? (
          <>
            <Dot />
            <Paperclip size={12} color={SdsColors.grey500} />
          </>
        ) : null}
        {item.isEdited ? (
          <>
            <Dot />
            <Pencil size={11} color={SdsColors.grey500} />
            <Txt typography="t7" color={SdsColors.grey500}>
              {t('notices.edited')}
            </Txt>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

function Dot() {
  return <View style={styles.dot} />;
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: SdsColors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: SdsColors.grey100,
    gap: 6,
  },
  rowPressed: {
    backgroundColor: SdsColors.grey50,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summary: {
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: SdsColors.grey400,
  },
});
