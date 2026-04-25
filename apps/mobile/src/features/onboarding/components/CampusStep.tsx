import { View, StyleSheet } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT, type Campus } from '@skkuverse/shared';
import { CampusCard } from './CampusCard';

interface Props {
  selected: Campus | null;
  onSelect: (campus: Campus) => void;
}

export function CampusStep({ selected, onSelect }: Props) {
  const { t } = useT();
  return (
    <View style={styles.container}>
      <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {t('onboarding.campusTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {t('onboarding.campusSubtitle')}
      </Txt>
      <CampusCard
        name={t('onboarding.hsscName')}
        location={t('onboarding.hsscLocation')}
        selected={selected === 'hssc'}
        onPress={() => onSelect('hssc')}
      />
      <CampusCard
        name={t('onboarding.nscName')}
        location={t('onboarding.nscLocation')}
        selected={selected === 'nsc'}
        onPress={() => onSelect('nsc')}
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
