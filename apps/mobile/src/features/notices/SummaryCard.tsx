import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { logAiSummaryView } from '@/services/analytics';
import { formatDisplayDate } from './utils/formatDisplayDate';
import type {
  NoticeDetailSummary,
  NoticePeriod,
  NoticeSummaryDetails,
  TranslationKey,
} from '@skkuverse/shared';

// Project deepgreen — same accent used by the onboarding pinned-card and
// the unified notice pill palette (NoticeRow.tsx). HTML mock proposed
// #00563F; we keep the existing palette to avoid re-fragmenting brand
// green right after the consolidation in 7bd5ba0.
const DEEPGREEN = '#1f3d2e';

interface Props {
  summary: NoticeDetailSummary;
  sourceId: string;
  articleNo: number;
}

/**
 * Renders the AI-generated summary card and a separate details card
 * on the notice detail screen. The two cards are visually separated:
 * card 1 = AI headline + text, card 2 = period/location/detail rows.
 */
export function SummaryCard({ summary, sourceId, articleNo }: Props) {
  const { t } = useT();

  // AI summary impression. Fires once per (notice, summary type) — refetch
  // with unchanged classification is a no-op. Mount itself is gated by
  // `data.summary != null` at the call site, so this always represents a
  // real user-facing AI card render.
  useEffect(() => {
    logAiSummaryView({
      sourceId,
      articleNo,
      summaryType: summary.type,
      hasOneLiner: !!summary.oneLiner?.trim(),
      hasPeriods: summary.periods.length > 0,
      hasLocations: summary.locations.length > 0,
      hasDetails: summary.details != null,
      model: summary.model,
    });
  }, [sourceId, articleNo, summary.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodEntries = summary.periods
    .map((p) => {
      const line = formatPeriod(p);
      return line ? { label: p.label, line } : null;
    })
    .filter((v): v is { label: string | null; line: string } => v !== null);
  const locationEntries = summary.locations;
  const detailRows = buildDetailRows(summary.details, t);

  const hasMetaRows =
    periodEntries.length > 0 ||
    locationEntries.length > 0 ||
    detailRows.length > 0;

  // Collect all rows for the meta card
  const metaRows: { label: string; value: string }[] = [];

  for (const e of periodEntries) {
    metaRows.push({
      label: e.label ?? t('notices.period'),
      value: e.line,
    });
  }

  for (const loc of locationEntries) {
    metaRows.push({
      label: t('notices.detailLabelLocation'),
      value: loc.label ? `${loc.label}: ${loc.detail}` : loc.detail,
    });
  }

  for (const row of detailRows) {
    metaRows.push({ label: row.label, value: row.value });
  }

  return (
    <>
      {/* Card 1: AI Summary — left-accent line, no surface fill */}
      {summary.text ? (
        <View style={styles.summaryCard}>
          <Txt
            typography="t7"
            fontWeight="semiBold"
            color={DEEPGREEN}
            style={styles.aiLabel}
          >
            {t('notices.aiSummaryLabel')}
          </Txt>
          <Txt
            typography="t6"
            fontWeight="medium"
            color={SdsColors.grey800}
            style={styles.text}
          >
            {summary.text}
          </Txt>
        </View>
      ) : null}

      {/* Card 2: Meta details */}
      {hasMetaRows ? (
        <View style={styles.metaCard}>
          {metaRows.map((row, i) => (
            <View key={`${row.label}-${i}`}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.metaRow}>
                <Txt typography="t7" color={SdsColors.grey500} style={styles.metaLabel}>
                  {row.label}
                </Txt>
                <Txt typography="t7" color={SdsColors.grey800} style={styles.metaValue} lineBreakStrategyIOS="hangul-word">
                  {row.value}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

// ── Helpers ──

interface DetailRowDef {
  key: keyof NoticeSummaryDetails;
  label: string;
  value: string;
}

function buildDetailRows(
  details: NoticeSummaryDetails | null,
  t: (key: TranslationKey) => string,
): DetailRowDef[] {
  if (!details) return [];
  const rows: DetailRowDef[] = [];
  if (details.target)
    rows.push({ key: 'target', label: t('notices.detailLabelTarget'), value: details.target });
  if (details.action)
    rows.push({ key: 'action', label: t('notices.detailLabelAction'), value: details.action });
  if (details.host)
    rows.push({ key: 'host', label: t('notices.detailLabelHost'), value: details.host });
  if (details.impact)
    rows.push({ key: 'impact', label: t('notices.detailLabelImpact'), value: details.impact });
  return rows;
}

/**
 * Builds a human-readable string for a single period.
 */
export function formatPeriod(period: NoticePeriod): string | null {
  const { startDate, startTime, endDate, endTime } = period;

  if (!startDate && !endDate) return null;

  if (startDate && endDate) {
    if (startDate === endDate) {
      if (startTime && endTime) {
        return `${formatDisplayDate(startDate)} ${startTime} ~ ${endTime}`;
      }
      if (startTime) return `${formatDisplayDate(startDate)} ${startTime}`;
      return formatDisplayDate(startDate);
    }
    return `${joinDateTime(startDate, startTime)} ~ ${joinDateTime(endDate, endTime)}`;
  }

  if (endDate) return `~${joinDateTime(endDate, endTime)}`;
  return `${joinDateTime(startDate!, startTime)}~`;
}

function joinDateTime(date: string, time: string | null): string {
  const d = formatDisplayDate(date);
  return time ? `${d} ${time}` : d;
}

const styles = StyleSheet.create({
  summaryCard: {
    marginTop: 12,
    paddingLeft: 12,
    paddingVertical: 2,
    borderLeftWidth: 2,
    borderLeftColor: DEEPGREEN,
    gap: 6,
  },
  aiLabel: {
    letterSpacing: 0.2,
  },
  text: {
    lineHeight: 22,
  },
  metaCard: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SdsColors.grey100,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey100,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  metaLabel: {
    width: 60,
    flexShrink: 0,
    marginRight: 12,
  },
  metaValue: {
    flex: 1,
  },
});
