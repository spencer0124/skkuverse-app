import { View, StyleSheet } from 'react-native';
import { Sparkle } from 'lucide-react-native';
import { SdsColors, useSettingsStore } from '@skkuverse/shared';
import { ListRow, Txt } from '@skkuverse/sds';
import type { AppLanguage, NoticeListItem } from '@skkuverse/shared';
import {
  formatDeadlineBadge,
  type DeadlineVariant,
} from './utils/formatDeadlineBadge';
import { formatRelativeDate } from './utils/formatRelativeDate';

interface Props {
  item: NoticeListItem;
  onPress: (item: NoticeListItem) => void;
}

const PILL_COLORS: Record<
  DeadlineVariant,
  { color: string; background: string }
> = {
  urgent: { color: '#F04452', background: 'rgba(240, 68, 82, 0.08)' },
  normal: { color: SdsColors.grey600, background: '#F2F3F5' },
  closed: { color: SdsColors.grey500, background: '#F2F3F5' },
  eventToday: {
    color: SdsColors.blue500,
    background: 'rgba(49, 130, 246, 0.08)',
  },
  inProgress: {
    color: SdsColors.green500,
    background: 'rgba(3, 178, 108, 0.08)',
  },
  upcoming: { color: SdsColors.grey500, background: SdsColors.grey50 },
};

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
      rightAlignment="top"
      right={
        <View style={styles.relativeSlot}>
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
      }
      contents={
        <View style={styles.contents}>
          <Txt
            typography="t5"
            fontWeight="semiBold"
            color={SdsColors.grey900}
            numberOfLines={2}
            style={styles.title}
          >
            {item.title}
          </Txt>
          {oneLiner.length > 0 ? (
            <View style={styles.oneLinerRow}>
              <Sparkle
                size={12}
                color={SdsColors.grey400}
                fill={SdsColors.grey400}
                style={styles.oneLinerIcon}
              />
              <Txt
                typography="t7"
                color={SdsColors.grey500}
                numberOfLines={1}
                style={styles.subText}
              >
                {oneLiner}
              </Txt>
            </View>
          ) : null}
          {deadline ? (
            <View style={styles.deadlineRow}>
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor:
                      PILL_COLORS[deadline.pill.variant].background,
                  },
                ]}
              >
                <Txt
                  typography="t7"
                  fontWeight="bold"
                  color={PILL_COLORS[deadline.pill.variant].color}
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
  title: {
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  oneLinerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  oneLinerIcon: {
    marginTop: 1,
    flexShrink: 0,
    opacity: 0.85,
  },
  subText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  relativeSlot: {
    minWidth: 48,
    alignItems: 'flex-end',
    marginTop: 5,
  },
  relativeText: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

