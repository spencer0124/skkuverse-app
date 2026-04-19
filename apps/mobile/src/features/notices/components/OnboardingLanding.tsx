import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { Txt, Button } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

interface Props {
  onStartPress: () => void;
}

export function OnboardingLanding({ onStartPress }: Props) {
  const { t } = useT();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Sparkles size={32} color={SdsColors.green500} />
        </View>
        <Txt typography="t3" color={SdsColors.grey900} style={styles.title}>
          {t('onboarding.landingTitle')}
        </Txt>
        <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
          {t('onboarding.landingSubtitle')}
        </Txt>
        <Button type="primary" size="big" display="block" onPress={onStartPress}>
          {t('onboarding.landingCta')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SdsColors.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SdsSpacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: SdsSpacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
  },
});
