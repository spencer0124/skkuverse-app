import { Fragment } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SdsColors, highlightMatches, useT } from '@skkuverse/shared';
import { ListRow, Txt, colorSeeds } from '@skkuverse/sds';
import type { NoticeListItem } from '@skkuverse/shared';
import { EyeIcon } from 'phosphor-react-native';
import { formatDeadlineBadge } from './utils/formatDeadlineBadge';
import { formatListDate } from './utils/formatListDate';

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
  /** Visual variant. `'card'` renders the row as a standalone card
   *  (used in home preview's letter-stack layout) — white bg, 16px inner
   *  padding, rounded corners. Default (undefined) renders as a flat row
   *  that blends into its parent list. */
  variant?: 'card';
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

/**
 * Flatten the deadline info into a footer segment ("D-22 · 지원 마감까지").
 *
 * Still un-pilled — it is plain text in the footer row, not a badge — but
 * it carries the one accent colour in the row: brand deepgreen. `expired`
 * is the single surviving distinction from the old six-variant palette,
 * because a passed deadline rendered in the brand action colour would read
 * as a live call to action. Everything else (urgent / event / inProgress …)
 * is conveyed by the wording alone; the detail screen's SummaryCard keeps
 * the full colour treatment.
 */
function formatDeadline(
  item: NoticeListItem,
): { text: string; expired: boolean } | null {
  const info = formatDeadlineBadge(item.summary ?? null);
  if (!info) return null;
  return {
    text: info.context ? `${info.pill.text} · ${info.context}` : info.pill.text,
    expired: info.pill.variant === 'closed',
  };
}

// Footer meta ink. Two steps darker than the old grey400 (#B0B8C1), which
// disappeared against white. grey600 also matches the department chip's
// text, so both meta tiers of the row read at the same volume — and it
// stays clearly subordinate to the grey900 title/summary block.
const FOOTER_COLOR = SdsColors.grey600;

// The row's single accent. Pulled from the SDS seed rather than repeating
// the literal — `#1f3d2e` is currently hand-copied into ~14 files, and this
// is not going to be the 15th.
const DEADLINE_COLOR = colorSeeds.primary;

// Thousands separators without touching Intl — Hermes ships `toLocaleString`
// but its behavior depends on whether the build has Intl compiled in, so a
// plain regex keeps the output identical on every device and in tests.
function formatViews(views: number): string {
  return String(views).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Horizontal padding inside the department chip. Also the exact amount the
// chip is pulled left, so the chip's text — not its box — lines up with the
// title. Change once, both stay in sync.
const DEPT_CHIP_PADDING_X = 6;

export function NoticeRow({
  item,
  onPress,
  showDepartment,
  highlightQuery,
  variant,
}: Props) {
  const { t } = useT();
  const isCard = variant === 'card';
  const oneLiner = item.summary?.oneLiner?.trim() ?? '';
  // Not every notice has an AI one-liner. Leaving the line empty makes row
  // heights ragged and reads as "the summary hasn't loaded yet", so fall
  // back to a pointer at where the content actually is. Card variant keeps
  // the blank — the home preview is deliberately sparse and a filler line
  // would add nothing there.
  const summaryText =
    oneLiner ||
    (isCard
      ? ''
      : item.hasAttachments
        ? t('notices.summaryFallbackAttachment')
        : t('notices.summaryFallback'));
  // Card variant (home preview) shows only title + one-liner. Both meta
  // lines and the deadline are intentionally hidden to keep the card
  // compact — full info is available on the detail screen.
  const deadline = isCard ? null : formatDeadline(item);
  const dateText = isCard ? '' : formatListDate(item.date);
  const deptLabel = !isCard && showDepartment ? item.department : undefined;
  // Footer meta: date and deadline are both "when" facts, so they share
  // one line below the summary, pipe-separated per the reference design.
  // The deadline keeps its own inner "·" ("D-22 · 지원 마감까지") because
  // the label modifies the D-day rather than standing beside it as a
  // peer — only top-level facts get a pipe.
  const footerSegments: { text: string; color: string }[] = [];
  if (dateText) footerSegments.push({ text: dateText, color: FOOTER_COLOR });
  if (deadline) {
    footerSegments.push({
      text: deadline.text,
      color: deadline.expired ? FOOTER_COLOR : DEADLINE_COLOR,
    });
  }
  // Bookmarks synthesize `views: 0` (saved.tsx) because the cached entry has
  // no view count — showing "0" there would assert something false, so the
  // whole views cluster is dropped when there is nothing real to report.
  const viewsText = !isCard && item.views > 0 ? formatViews(item.views) : null;

  return (
    <ListRow
      onPress={() => onPress(item)}
      style={[styles.row, isCard && styles.rowCard]}
      containerStyle={[styles.container, isCard && styles.containerCard]}
      contents={
        <View style={styles.contents}>
          {/* Header meta — source identity only. No attachment indicator:
              a lone paperclip carried little signal in the list, and rows
              with no one-liner already say "첨부파일 참고" where it matters.
              Still a row wrapper rather than the bare chip, because
              `flexShrink` only bites on a flex main axis — in the column
              `contents` a long department name would overflow instead of
              truncating. */}
          {deptLabel ? (
            <View style={styles.metaRow}>
              <View style={styles.deptChip}>
                <Txt
                  typography="t7"
                  fontWeight="medium"
                  color={SdsColors.grey600}
                  numberOfLines={1}
                  style={styles.deptChipText}
                >
                  {deptLabel}
                </Txt>
              </View>
            </View>
          ) : null}
          {/* Title and summary share one type size — hierarchy comes from
              weight (bold vs regular) and color (grey900 vs grey500), not
              scale. Title is hard-capped at one line so every row's first
              line starts at the same y; the summary absorbs the extra
              height instead. Card variant keeps semiBold + its own metric
              so the home preview is unaffected by list-title tuning. */}
          <Txt
            typography="t5"
            fontWeight={isCard ? 'semiBold' : 'bold'}
            color={SdsColors.grey900}
            numberOfLines={1}
            style={[styles.title, isCard && styles.titleCard]}
          >
            {renderTitleWithHighlight(item.title, highlightQuery)}
          </Txt>
          {/* Line-breaking props, both deliberate and both single-platform:
              - `standard` is NSLineBreakStrategyStandard, which the SDK
                defines as 0xFFFF — a superset of PushOut (1<<0) and
                HangulWordPriority (1<<1). So this is not a trade against
                the previous "hangul-word": Korean word priority is kept
                and push-out is gained.
              - `balanced` is BREAK_STRATEGY_BALANCED and is ANDROID ONLY.
                iOS never reads textBreakStrategy (no reference to it
                anywhere under the iOS textlayoutmanager), and iOS has no
                balanced-wrapping API at all — so a 33-char summary still
                wraps ~29 + ~4 there. Don't re-investigate that; it is a
                platform ceiling, not a bug here.
              The previous value "highQuality" was a no-op: it is already
              the default on both the C++ and Android sides. */}
          {summaryText.length > 0 ? (
            <Txt
              typography="t7"
              color={isCard ? SdsColors.grey500 : SdsColors.grey900}
              numberOfLines={isCard ? 1 : 2}
              lineBreakStrategyIOS="standard"
              textBreakStrategy="balanced"
              style={styles.subText}
            >
              {summaryText}
            </Txt>
          ) : null}
          {/* Separators are 1pt <View>s, not "|" glyphs. A pipe character
              sits wherever the font's bar happens to sit inside the line
              box — never optically centred against digits — and its
              thickness is whatever the typeface says. A View under
              `alignItems: 'center'` is exactly centred, exactly 1pt, and
              its `marginHorizontal` gives the breathing room a glyph
              would need spaces to fake. */}
          {(viewsText || footerSegments.length > 0) ? (
            <View style={styles.footerRow}>
              {viewsText ? (
                <>
                  <EyeIcon
                    size={13}
                    color={FOOTER_COLOR}
                    style={styles.footerIcon}
                  />
                  <Txt
                    typography="t7"
                    color={FOOTER_COLOR}
                    numberOfLines={1}
                    style={[styles.footerText, styles.viewsText]}
                  >
                    {viewsText}
                  </Txt>
                </>
              ) : null}
              {footerSegments.map((segment, i) => (
                <Fragment key={segment.text}>
                  {(viewsText || i > 0) ? (
                    <View style={styles.footerSep} />
                  ) : null}
                  <Txt
                    typography="t7"
                    fontWeight={
                      segment.color === DEADLINE_COLOR ? 'medium' : 'regular'
                    }
                    color={segment.color}
                    numberOfLines={1}
                    style={styles.footerText}
                  >
                    {segment.text}
                  </Txt>
                </Fragment>
              ))}
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
  // Card variant — standalone card. `overflow: 'hidden'` clips
  // the ListRow press underlay flash at the rounded corners.
  rowCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  container: {
    paddingVertical: 16,
  },
  containerCard: {
    paddingVertical: 14,
  },
  // No `gap` here on purpose: a uniform gap forces chip→title, title→summary
  // and summary→footer to move together, but they are three different
  // relationships. Title and summary are one content block (tightest), the
  // chip and the footer are separate tiers. Each spacing is owned by the
  // element below it instead.
  contents: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  // Department renders as a filled chip (reference design). grey100 rather
  // than the sampled #F9F9F9 — that value is only 6 levels off white and
  // effectively disappears as a chip; grey100 is the SDS badge token and
  // reads as an actual container.
  //
  // Optically aligned by its TEXT, not its box: `marginLeft` cancels
  // `paddingHorizontal` so the first glyph lands on the same x as the
  // title below (ListRow's 24pt content edge) instead of the box edge
  // landing there and pushing the label 6pt right. Both derive from
  // DEPT_CHIP_PADDING_X so they can never drift apart.
  deptChip: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: SdsColors.grey100,
    paddingHorizontal: DEPT_CHIP_PADDING_X,
    marginLeft: -DEPT_CHIP_PADDING_X,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptChipText: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  // Clear air above the footer so it reads as a separate tier from the
  // summary it follows, not a third summary line. `alignItems: 'center'` is
  // what centres both the eye icon and the 1pt separators against the
  // digits — the whole reason the separators are Views rather than glyphs.
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  footerIcon: {
    marginRight: 3,
  },
  // `tabular-nums` matters more than it looks: WantedSans' proportional
  // digits range from 880 (1) to 1280 (0) units, so "11/11" and "07/30"
  // render at different widths and the separators after them never line
  // up. The font ships a `tnum` feature in all three weights, which snaps
  // every digit to 1280.
  footerText: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  // Reserve a 3-digit slot (3 tabular digits at 1280/2048 em = 22.5pt at
  // 12pt, rounded up) and left-align inside it, so 1- and 2-digit counts
  // pad on the right and the first separator holds one column. Counts of
  // 1,000+ overflow the slot and push that row's separator right — the
  // accepted trade for not reserving dead space on the common case.
  viewsText: {
    minWidth: 23,
  },
  // grey300 rather than FOOTER_COLOR: a crisp 1pt fill reads heavier than an
  // antialiased "|" glyph at the same value, so matching the text colour
  // would make the dividers louder than the data they separate.
  footerSep: {
    width: 1,
    height: 10,
    backgroundColor: SdsColors.grey300,
    marginHorizontal: 11,
  },
  // Same metric as `subText` below — see the render comment. Kept separate
  // from `titleCard` on purpose: the home preview card should not follow
  // list-title size tuning even while the two values coincide.
  title: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  titleCard: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  // No marginTop — title and summary are one block, so the only separation
  // is the 6pt of leading already baked into lineHeight 20 on 14pt text.
  subText: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  // Inline emphasis on matched search substrings. fontSize/lineHeight
  // intentionally OMITTED so the segment inherits from the parent
  // <Txt>'s explicit title style (14/20) — keeps glyph size identical
  // across the row regardless of which substring is matched.
  highlightedSegment: {
    color: SdsColors.blue500,
    fontWeight: 'bold' as const,
  },
});

