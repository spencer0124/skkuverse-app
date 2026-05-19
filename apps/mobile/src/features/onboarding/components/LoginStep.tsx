import { StyleSheet, View } from 'react-native';
import { Txt } from '@skkuverse/sds';
import {
  SdsColors,
  SdsSpacing,
  useT,
  type Campus,
  type TabSource,
} from '@skkuverse/shared';

interface Props {
  campus: Campus;
  primaryDeptId: string;
  interestDeptIds: string[];
  sources: TabSource[];
  loginError: string | null;
}

export function LoginStep({
  campus,
  primaryDeptId,
  interestDeptIds,
  sources,
  loginError,
}: Props) {
  const { t } = useT();

  const campusName = campus === 'hssc'
    ? t('onboarding.hsscName')
    : t('onboarding.nscName');

  const primaryName = sources.find((s) => s.id === primaryDeptId)?.name ?? '';
  const interestNames = interestDeptIds
    .map((id) => sources.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ') || t('onboarding.summaryNone');

  return (
    <View style={styles.container}>
      <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {t('onboarding.loginTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {t('onboarding.loginSubtitle')}
      </Txt>

      <View style={styles.summaryCard}>
        <SummaryRow label={t('onboarding.summaryCampus')} value={campusName} />
        <SummaryRow label={t('onboarding.summaryPrimaryDept')} value={primaryName} />
        <SummaryRow label={t('onboarding.summaryInterestDept')} value={interestNames} />
      </View>

      <View style={styles.spacer} />

      {loginError && (
        <Txt typography="t7" color={SdsColors.red500} style={styles.error}>
          {loginError}
        </Txt>
      )}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Txt typography="t7" color={SdsColors.grey400} style={styles.summaryLabel}>
        {label}
      </Txt>
      <Txt
        typography="t7"
        fontWeight="medium"
        color={SdsColors.grey900}
        style={styles.summaryValue}
      >
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginTop: 8,
    marginBottom: 14,
  },
  subtitle: {
    marginBottom: 36,
  },
  summaryCard: {
    backgroundColor: SdsColors.grey50,
    borderRadius: 16,
    padding: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 7,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    width: 72,
  },
  summaryValue: {
    flex: 1,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  error: {
    textAlign: 'center',
    marginBottom: SdsSpacing.sm,
  },
});
