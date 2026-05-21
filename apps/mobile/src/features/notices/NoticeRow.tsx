import { Text, View, StyleSheet } from 'react-native';
import { SdsColors, highlightMatches, useSettingsStore } from '@skkuverse/shared';
import { ListRow, Txt } from '@skkuverse/sds';
import type { AppLanguage, NoticeListItem } from '@skkuverse/shared';
import { PaperclipIcon } from 'phosphor-react-native';
import { formatDeadlineBadge, type DeadlineInfo } from './utils/formatDeadlineBadge';
import { formatRelativeDate } from './utils/formatRelativeDate';

interface Props {
  item: NoticeListItem;
  onPress: (item: NoticeListItem) => void;
  /** Show department label (only for multi-dept tabs like 학과/도서관). */
  showDepartment?: boolean;
  /** Search query — when set, the matched substrings inside the title
   *  are wrapped in a styled inner <Text> (case-insensitive match,
   *  original casing preserved). Empty / undefined renders the title
   *  verbatim. */
  highlightQuery?: string;
  /** Compact preview (e.g. home tab): renders title + one-liner only.
   *  Hides meta row (date · dept · paperclip) and deadline badges. */
  compact?: boolean;
}

// Plain RN <Text> (not SDS <Txt>) so the matched segment inherits the
// outer parent's fontSize / lineHeight via RN's text-style inheritance.
// SDS <Txt> applies its own typography defaults (default 't5') which
// overrides the parent's explicit style.fontSize=16 — causing the
// highlighted glyphs to render at a different size than the surrounding
// title. Plain <Text> only carries the styles we explicitly set (color
// + weight), so size matches the parent.
function renderTitleWithHighlight(title: string, query: string | undefined) {
  if (!query) return title;
  return highlightMatches(title, query).map((seg, i) =>
    seg.matched ? (
      <Text key={i} style={styles.highlightedSegment}>
        {seg.text}
      </Text>
    ) : (
      seg.text
    ),
  );
}

// SKKU deepgreen (#1f3d2e) on green50 (#F0FAF6) — matches the onboarding
// pinned-card / wizard-accent palette. Single brand action color.
const DEEPGREEN = '#1f3d2e';
const PILL_COLORS: Partial<Record<string, { color: string; background: string }>> = {
  urgent: { color: '#F04452', background: 'rgba(240, 68, 82, 0.08)' },
  normal: { color: DEEPGREEN, background: SdsColors.green50 },
  closed: { color: '#8B95A1', background: '#F2F4F6' },
  eventToday: { color: DEEPGREEN, background: SdsColors.green50 },
  inProgress: { color: DEEPGREEN, background: SdsColors.green50 },
  upcoming: { color: DEEPGREEN, background: SdsColors.green50 },
};
const DEFAULT_PILL = { color: DEEPGREEN, background: SdsColors.green50 };

function isFixedBadge(d: DeadlineInfo): boolean {
  return d.pill.variant === 'closed';
}

function renderPill(info: DeadlineInfo) {
  const colors = PILL_COLORS[info.pill.variant] ?? DEFAULT_PILL;
  const label = info.context
    ? `${info.pill.text} · ${info.context}`
    : info.pill.text;
  return (
    <View style={[styles.pill, { backgroundColor: colors.background }]}>
      <Txt
        typography="t7"
        fontWeight="bold"
        color={colors.color}
        numberOfLines={1}
        style={styles.pillText}
      >
        {label}
      </Txt>
    </View>
  );
}

export function NoticeRow({
  item,
  onPress,
  showDepartment,
  highlightQuery,
  compact,
}: Props) {
  const oneLiner = item.summary?.oneLiner?.trim() ?? '';
  const deadline = compact ? null : formatDeadlineBadge(item.summary ?? null);
  const fixedBadge = deadline && isFixedBadge(deadline) ? deadline : null;
  const belowBadge  = deadline && !isFixedBadge(deadline) ? deadline : null;
  const lang = useSettingsStore((s) => s.appLanguage) as AppLanguage;
  const relativeDate = compact ? '' : formatRelativeDate(item.date, lang);
  const deptLabel = !compact && showDepartment ? item.department : undefined;

  return (
    <ListRow
      onPress={() => onPress(item)}
      style={[styles.row, compact && styles.rowCompact]}
      containerStyle={[styles.container, compact && styles.containerCompact]}
      horizontalPadding={compact ? 0 : undefined}
      contents={
        <View style={styles.contents}>
          {(relativeDate || deptLabel) ? (
            <View style={styles.metaRow}>
              {relativeDate ? (
                <Txt
                  typography="t7"
                  color={SdsColors.grey400}
                  style={styles.metaText}
                >
                  {relativeDate}
                </Txt>
              ) : null}
              {relativeDate && deptLabel ? (
                <Txt
                  typography="t7"
                  color={SdsColors.grey300}
                  style={styles.metaText}
                >
                  {' · '}
                </Txt>
              ) : null}
              {deptLabel ? (
                <Txt
                  typography="t7"
                  color={SdsColors.grey400}
                  numberOfLines={1}
                  style={[styles.metaText, styles.deptText]}
                >
                  {deptLabel}
                </Txt>
              ) : null}
              {item.hasAttachments ? (
                <PaperclipIcon size={12} color={SdsColors.grey400} style={styles.clipIcon} />
              ) : null}
            </View>
          ) : null}
          <Txt
            typography="t5"
            fontWeight="semiBold"
            color={SdsColors.grey900}
            numberOfLines={compact ? 1 : 2}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
            style={[styles.title, fixedBadge && styles.titleWithBadge]}
          >
            {renderTitleWithHighlight(item.title, highlightQuery)}
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
          {belowBadge ? (
            <View style={styles.deadlineRow}>
              {renderPill(belowBadge)}
            </View>
          ) : null}
          {fixedBadge ? (
            <View style={styles.fixedBadgeFixed}>{renderPill(fixedBadge)}</View>
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
  // Compact (home preview) — transparent so the row blends into the page
  // background instead of looking like a floating white chit when used
  // outside a wrapping card.
  rowCompact: {
    backgroundColor: 'transparent',
  },
  container: {
    paddingVertical: 16,
  },
  containerCompact: {
    paddingVertical: 12,
  },
  contents: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  deptText: {
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  titleWithBadge: {
    paddingRight: 56,
  },
  fixedBadgeFixed: {
    position: 'absolute',
    right: 0,
    top: 22,
  },
  clipIcon: {
    marginLeft: 4,
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
  // Inline emphasis on matched search substrings. fontSize/lineHeight
  // intentionally OMITTED so the segment inherits from the parent
  // <Txt>'s explicit title style (16/23) — keeps glyph size identical
  // across the row regardless of which substring is matched.
  highlightedSegment: {
    color: SdsColors.blue500,
    fontWeight: 'bold' as const,
  },
});

