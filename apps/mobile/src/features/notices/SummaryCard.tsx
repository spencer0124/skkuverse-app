import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Calendar,
  Users,
  CheckSquare,
  MapPin,
  Building2,
  Sparkle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { formatDisplayDate } from './utils/formatDisplayDate';
import type {
  NoticeDetailSummary,
  NoticeLocation,
  NoticePeriod,
  NoticeSummaryDetails,
  TranslationKey,
} from '@skkuverse/shared';

interface Props {
  summary: NoticeDetailSummary;
}

/**
 * Renders the AI-generated summary card on the notice detail screen:
 * one-liner headline, full text, period(s), location(s), and the structured
 * `details` rows (target / action / host / impact). Each section is
 * conditional — empty arrays and null fields are hidden.
 *
 * Multi-phase notices (e.g. 1차/2차 납부) render as multiple period lines
 * under one Calendar row. Multi-location notices do the same under MapPin.
 */
export function SummaryCard({ summary }: Props) {
  const { t } = useT();

  const periodEntries = summary.periods
    .map((p) => {
      const line = formatPeriod(p);
      return line ? { label: p.label, line } : null;
    })
    .filter((v): v is { label: string | null; line: string } => v !== null);
  const locationEntries = summary.locations;
  const detailRows = buildDetailRows(summary.details, t);
  const hasAnyContent =
    !!summary.text ||
    periodEntries.length > 0 ||
    locationEntries.length > 0 ||
    detailRows.length > 0;

  if (!hasAnyContent) return null;

  const hasTopBlock =
    !!summary.text || periodEntries.length > 0 || locationEntries.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.aiHeader}>
        <Sparkle
          size={14}
          color={SdsColors.grey600}
          fill={SdsColors.grey600}
          style={styles.aiHeaderIcon}
        />
        <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600}>
          {t('notices.aiSummaryLabel')}
        </Txt>
      </View>

      {summary.text ? (
        <Txt typography="t6" color={SdsColors.grey700} style={styles.text}>
          {summary.text}
        </Txt>
      ) : null}

      {periodEntries.length > 0 ? (
        <StackRow
          icon={Calendar}
          label={t('notices.period')}
          values={periodEntries.map((e) =>
            e.label ? `${e.label}: ${e.line}` : e.line,
          )}
        />
      ) : null}

      {locationEntries.length > 0 ? (
        <StackRow
          icon={MapPin}
          label={t('notices.detailLabelLocation')}
          values={locationEntries.map((loc) =>
            loc.label ? `${loc.label}: ${loc.detail}` : loc.detail,
          )}
        />
      ) : null}

      {detailRows.length > 0 ? (
        <>
          {hasTopBlock ? <View style={styles.divider} /> : null}
          <View style={styles.detailRows}>
            {detailRows.map((row) => (
              <InfoRow
                key={row.key}
                icon={row.icon}
                label={row.label}
                value={row.value}
              />
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

interface StackRowProps {
  icon: LucideIcon;
  label: string;
  values: string[];
}

/**
 * Multi-line variant of InfoRow: icon + label on the left, and each value
 * on its own row on the right. Used when a single period/location field
 * has multiple entries (e.g. 1차 납부 / 2차 납부).
 */
function StackRow({ icon: Icon, label, values }: StackRowProps) {
  if (values.length === 1) {
    return <InfoRow icon={Icon} label={label} value={values[0]} />;
  }
  return (
    <View style={styles.row}>
      <Icon size={14} color={SdsColors.grey600} style={styles.rowIcon} />
      <Txt typography="t7" color={SdsColors.grey500} style={styles.rowLabel}>
        {label}
      </Txt>
      <View style={styles.stackValues}>
        {values.map((v, i) => (
          <Txt
            key={i}
            typography="t7"
            color={SdsColors.grey800}
            style={styles.rowValue}
          >
            {v}
          </Txt>
        ))}
      </View>
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
  if (details.target)
    rows.push({
      key: 'target',
      icon: Users,
      label: t('notices.detailLabelTarget'),
      value: details.target,
    });
  if (details.action)
    rows.push({
      key: 'action',
      icon: CheckSquare,
      label: t('notices.detailLabelAction'),
      value: details.action,
    });
  if (details.host)
    rows.push({
      key: 'host',
      icon: Building2,
      label: t('notices.detailLabelHost'),
      value: details.host,
    });
  if (details.impact)
    rows.push({
      key: 'impact',
      icon: Sparkles,
      label: t('notices.detailLabelImpact'),
      value: details.impact,
    });
  return rows;
}

/**
 * Builds a human-readable string for a single period. Returns `null`
 * when the period carries no date at all (should be rare — server only
 * emits meaningful periods, but we defend defensively).
 */
export function formatPeriod(period: NoticePeriod): string | null {
  const { startDate, startTime, endDate, endTime } = period;

  if (!startDate && !endDate) return null;

  if (startDate && endDate) {
    if (startDate === endDate) {
      // Same day → optionally show start~end time
      if (startTime && endTime) {
        return `${formatDisplayDate(startDate)} ${startTime} ~ ${endTime}`;
      }
      if (startTime) return `${formatDisplayDate(startDate)} ${startTime}`;
      return formatDisplayDate(startDate);
    }
    return `${joinDateTime(startDate, startTime)} ~ ${joinDateTime(endDate, endTime)}`;
  }

  if (endDate) {
    // 마감만 있는 경우
    return `~${joinDateTime(endDate, endTime)}`;
  }

  // startDate만 있는 경우
  return `${joinDateTime(startDate!, startTime)}~`;
}

function joinDateTime(date: string, time: string | null): string {
  const d = formatDisplayDate(date);
  return time ? `${d} ${time}` : d;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: SdsColors.grey50,
    gap: 8,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiHeaderIcon: {
    opacity: 0.7,
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
  stackValues: {
    flex: 1,
    gap: 3,
  },
});
