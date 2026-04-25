import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretLeftIcon, XIcon } from 'phosphor-react-native';
import {
  Button,
  FixedBottomCTA,
  IconButton,
  ProgressBar,
  TextButton,
  Txt,
} from '@skkuverse/sds';
import { SdsColors, SdsSpacing } from '@skkuverse/shared';
import { TOTAL_STEPS, type OnboardingStep } from '../types';

interface Props {
  step: OnboardingStep;
  onBack: () => void;
  onClose: () => void;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaPress: () => void;
  /** Replace default CTA button with custom content (e.g. Google Sign-In) */
  ctaContent?: ReactNode;
  /** Optional secondary action (e.g. "건너뛸래요" in step 3) */
  secondaryAction?: { label: string; onPress: () => void };
  /** Text below CTA (e.g. "성대생은 무료예요") */
  ctaFineprint?: string;
  /** Hide progress bar + back button (e.g. completion step) */
  minimal?: boolean;
  children: ReactNode;
}

export function OnboardingLayout({
  step,
  onBack,
  onClose,
  ctaLabel,
  ctaDisabled = false,
  onCtaPress,
  ctaContent,
  secondaryAction,
  ctaFineprint,
  minimal = false,
  children,
}: Props) {
  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!minimal && (
        <View style={styles.topBar}>
          {step > 1 ? (
            <IconButton
              icon={<CaretLeftIcon size={22} color={SdsColors.grey900} />}
              onPress={onBack}
              label="뒤로"
            />
          ) : (
            <View style={styles.placeholder} />
          )}
          <ProgressBar
            progress={progress}
            size="light"
            withAnimation
            color={SdsColors.green500}
            style={styles.progressBar}
          />
          <IconButton
            icon={<XIcon size={20} color={SdsColors.grey900} />}
            onPress={onClose}
            label="닫기"
          />
        </View>
      )}

      <View style={styles.content}>{children}</View>

      <FixedBottomCTA>
        {ctaContent ?? (
          <Button
            type="primary"
            size="big"
            display="block"
            disabled={ctaDisabled}
            onPress={onCtaPress}
          >
            {ctaLabel}
          </Button>
        )}
        {secondaryAction && (
          <TextButton
            typography="t6"
            color={SdsColors.grey400}
            fontWeight="medium"
            onPress={secondaryAction.onPress}
            style={styles.secondaryButton}
          >
            {secondaryAction.label}
          </TextButton>
        )}
        {ctaFineprint && (
          <Txt typography="t7" color={SdsColors.grey400} style={styles.fineprint}>
            {ctaFineprint}
          </Txt>
        )}
      </FixedBottomCTA>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.md,
    gap: SdsSpacing.sm,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  progressBar: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SdsSpacing.xl,
    paddingTop: SdsSpacing.md,
  },
  secondaryButton: {
    alignSelf: 'center',
    marginTop: SdsSpacing.xs,
    paddingVertical: SdsSpacing.sm,
  },
  fineprint: {
    textAlign: 'center',
    marginTop: SdsSpacing.sm,
  },
});
