import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Calendar,
  Users,
  CheckSquare,
  MapPin,
  Building2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type {
  NoticeDetailSummary,
  NoticeSummaryDetails,
  TranslationKey,
} from '@skkuverse/shared';

interface Props {
  summary: NoticeDetailSummary;
}

/**
 * Renders the AI-generated summary card on the notice detail screen:
 * one-liner headline, full text, period (start/end date+time), and the
 * structured `details` rows (target / action / location / host / impact).
 *
 * Each section is conditional — null fields are hidden.
 */
export function SummaryCard({ summary }: Props) {
  const { t, tpl } = useT();

  const period = formatSummaryPeriod(summary);
  const detailRows = buildDetailRows(summary.details, t);
  const hasAnyContent = !!summary.text || !!period || detailRows.length > 0;

  if (!hasAnyContent) return null;

  return (
    <View style={styles.card}>
      {summary.text ? (
        <Txt typography="t6" color={SdsColors.grey700} style={styles.text}>
          {summary.text}
        </Txt>
      ) : null}

      {period ? (
        <InfoRow
          icon={Calendar}
          label={t('notices.period')}
          value={
            period.kind === 'range'
              ? tpl('notices.periodRange', period.start, period.end)
              : period.value
          }
        />
      ) : null}

      {detailRows.length > 0 ? (
        <>
          {summary.text || period ? <View style={styles.divider} /> : null}
          <View style={styles.detailRows}>
            {detailRows.map((row) => (
              <InfoRow key={row.key} icon={row.icon} label={row.label} value={row.value} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <Icon size={14} color={SdsColors.grey600} style={styles.rowIcon} />
      <Txt typography="t7" color={SdsColors.grey500} style={styles.rowLabel}>
        {label}
      </Txt>
      <Txt typography="t7" color={SdsColors.grey800} style={styles.rowValue}>
        {value}
      </Txt>
    </View>
  );
}

// ── Helpers ──

interface DetailRowDef {
  key: keyof NoticeSummaryDetails;
  icon: LucideIcon;
  label: string;
  value: string;
}

function buildDetailRows(
  details: NoticeSummaryDetails | null,
  t: (key: TranslationKey) => string,
): DetailRowDef[] {
  if (!details) return [];
  const rows: DetailRowDef[] = [];
  if (details.target) rows.push({ key: 'target', icon: Users, label: t('notices.detailLabelTarget'), value: details.target });
  if (details.action) rows.push({ key: 'action', icon: CheckSquare, label: t('notices.detailLabelAction'), value: details.action });
  if (details.location) rows.push({ key: 'location', icon: MapPin, label: t('notices.detailLabelLocation'), value: details.location });
  if (details.host) rows.push({ key: 'host', icon: Building2, label: t('notices.detailLabelHost'), value: details.host });
  if (details.impact) rows.push({ key: 'impact', icon: Sparkles, label: t('notices.detailLabelImpact'), value: details.impact });
  return rows;
}

type Period =
  | { kind: 'single'; value: string }
  | { kind: 'range'; start: string; end: string };

/**
 * Builds a human-readable period string from the AI summary's
 * start/end date+time fields. Returns `null` when no date is available.
 */
export function formatSummaryPeriod(summary: NoticeDetailSummary): Period | null {
  const { startDate, startTime, endDate, endTime } = summary;

  if (!startDate && !endDate) return null;

  if (startDate && endDate) {
    if (startDate === endDate) {
      // Same day → optionally show start~end time
      if (startTime && endTime) {
        return { kind: 'single', value: `${startDate} ${startTime} ~ ${endTime}` };
      }
      if (startTime) return { kind: 'single', value: `${startDate} ${startTime}` };
      return { kind: 'single', value: startDate };
    }
    return {
      kind: 'range',
      start: joinDateTime(startDate, startTime),
      end: joinDateTime(endDate, endTime),
    };
  }

  if (endDate) {
    // 마감만 있는 경우
    return { kind: 'single', value: `~${joinDateTime(endDate, endTime)}` };
  }

  // startDate만 있는 경우
  return { kind: 'single', value: `${joinDateTime(startDate!, startTime)}~` };
}

function joinDateTime(date: string, time: string | null): string {
  return time ? `${date} ${time}` : date;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: SdsColors.grey50,
    gap: 8,
  },
  text: {
    lineHeight: 22,
  },
  divider: {
    marginTop: 4,
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey200,
  },
  detailRows: {
    marginTop: 4,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  rowIcon: {
    marginTop: 3,
  },
  rowLabel: {
    width: 60,
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
  },
});
