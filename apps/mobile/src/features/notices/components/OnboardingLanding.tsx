import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SparkleIcon } from 'phosphor-react-native';
import { Txt, Button, TextButton } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

interface Props {
  onStartPress: () => void;
  onExistingAccountPress: () => void;
  /** Disable both CTAs while a sign-in flow is in flight (prevents double-tap). */
  loading?: boolean;
  /** Inline error message (e.g. domain not allowed, network failure). */
  signInError?: string | null;
}

export function OnboardingLanding({
  onStartPress,
  onExistingAccountPress,
  loading = false,
  signInError = null,
}: Props) {
  const { t } = useT();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <SparkleIcon size={32} color={SdsColors.green500} />
        </View>
        <Txt typography="t3" color={SdsColors.grey900} style={styles.title}>
          {t('onboarding.landingTitle')}
        </Txt>
        <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
          {t('onboarding.landingSubtitle')}
        </Txt>
        <Button
          type="primary"
          size="big"
          display="block"
          onPress={onStartPress}
          disabled={loading}
        >
          {t('onboarding.landingCta')}
        </Button>
        <TextButton
          typography="t6"
          color={SdsColors.grey400}
          fontWeight="medium"
          onPress={onExistingAccountPress}
          disabled={loading}
          style={styles.existingAccountButton}
        >
          {t('onboarding.landingExistingAccountCta')}
        </TextButton>
        {signInError ? (
          <Txt typography="t7" color={SdsColors.red500} style={styles.error}>
            {signInError}
          </Txt>
        ) : null}
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
  existingAccountButton: {
    alignSelf: 'center',
    marginTop: SdsSpacing.xs,
    paddingVertical: SdsSpacing.sm,
  },
  error: {
    textAlign: 'center',
    marginTop: SdsSpacing.sm,
  },
});
