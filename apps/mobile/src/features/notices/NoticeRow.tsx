import { View, StyleSheet } from 'react-native';
import { SdsColors, useSettingsStore } from '@skkuverse/shared';
import { ListRow, Txt } from '@skkuverse/sds';
import type { AppLanguage, NoticeListItem } from '@skkuverse/shared';
import { formatDeadlineBadge } from './utils/formatDeadlineBadge';
import { formatRelativeDate } from './utils/formatRelativeDate';

interface Props {
  item: NoticeListItem;
  onPress: (item: NoticeListItem) => void;
}

const PILL_COLORS: Partial<Record<string, { color: string; background: string }>> = {
  urgent: { color: '#F04452', background: 'rgba(240, 68, 82, 0.08)' },
  eventToday: { color: SdsColors.green500, background: 'rgba(3, 178, 108, 0.08)' },
  inProgress: { color: SdsColors.green500, background: 'rgba(3, 178, 108, 0.08)' },
};
const DEFAULT_PILL = { color: SdsColors.grey600, background: '#F2F3F5' };

export function NoticeRow({ item, onPress }: Props) {
  const oneLiner = item.summary?.oneLiner?.trim() ?? '';
  const deadline = formatDeadlineBadge(item.summary ?? null);
  const lang = useSettingsStore((s) => s.appLanguage) as AppLanguage;
  const relativeDate = formatRelativeDate(item.date, lang);

  return (
    <ListRow
      onPress={() => onPress(item)}
      style={styles.row}
      containerStyle={styles.container}
      contents={
        <View style={styles.contents}>
          {(item.department || relativeDate) ? (
            <View style={styles.metaRow}>
              {item.department ? (
                <Txt
                  typography="t7"
                  color={SdsColors.grey400}
                  numberOfLines={1}
                  style={styles.deptText}
                >
                  {item.department}
                </Txt>
              ) : <View style={styles.spacer} />}
              {relativeDate ? (
                <Txt
                  typography="t7"
                  color={SdsColors.grey400}
                  style={styles.relativeText}
                >
                  {relativeDate}
                </Txt>
              ) : null}
            </View>
          ) : null}
          <Txt
            typography="t5"
            fontWeight="semiBold"
            color={SdsColors.grey900}
            numberOfLines={2}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
            style={styles.title}
          >
            {item.title}
          </Txt>
          {oneLiner.length > 0 ? (
            <Txt
              typography="t7"
              color={SdsColors.grey500}
              numberOfLines={1}
              style={styles.subText}
            >
              {oneLiner}
            </Txt>
          ) : null}
          {deadline ? (
            <View style={styles.deadlineRow}>
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor:
                      (PILL_COLORS[deadline.pill.variant] ?? DEFAULT_PILL).background,
                  },
                ]}
              >
                <Txt
                  typography="t7"
                  fontWeight="bold"
                  color={(PILL_COLORS[deadline.pill.variant] ?? DEFAULT_PILL).color}
                  numberOfLines={1}
                  style={styles.pillText}
                >
                  {deadline.context
                    ? `${deadline.pill.text} · ${deadline.context}`
                    : deadline.pill.text}
                </Txt>
              </View>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    paddingVertical: 16,
  },
  contents: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deptText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  spacer: {
    flex: 1,
  },
  relativeText: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
    marginLeft: 8,
  },
  title: {
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  subText: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
});

