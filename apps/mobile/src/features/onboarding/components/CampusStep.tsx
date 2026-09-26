import { View, StyleSheet } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT, type Campus } from '@skkuverse/shared';
import { CampusCard } from './CampusCard';
import { logOnboardingStep } from '@/services/analytics';

interface Props {
  selected: Campus | null;
  onSelect: (campus: Campus) => void;
  /** Overrides the notices-flavoured subtitle when the step is reused elsewhere. */
  subtitle?: string;
  /** Log onboarding funnel events. Off when the step is reused outside the wizard. */
  track?: boolean;
}

export function CampusStep({ selected, onSelect, subtitle, track = true }: Props) {
  const { t } = useT();
  const handleSelect = (campus: Campus) => {
    if (track) logOnboardingStep({ step: 'campus', action: 'select_campus', detail: campus });
    onSelect(campus);
  };
  return (
    <View style={styles.container}>
      <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {t('onboarding.campusTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {subtitle ?? t('onboarding.campusSubtitle')}
      </Txt>
      <CampusCard
        name={t('onboarding.hsscName')}
        location={t('onboarding.hsscLocation')}
        selected={selected === 'hssc'}
        onPress={() => handleSelect('hssc')}
      />
      <CampusCard
        name={t('onboarding.nscName')}
        location={t('onboarding.nscLocation')}
        selected={selected === 'nsc'}
        onPress={() => handleSelect('nsc')}
      />
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
});
