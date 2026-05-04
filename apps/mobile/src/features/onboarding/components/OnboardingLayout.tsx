import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretLeftIcon } from 'phosphor-react-native';
import {
  Button,
  FixedBottomCTA,
  IconButton,
  TextButton,
  Txt,
} from '@skkuverse/sds';
import { SdsColors, SdsSpacing } from '@skkuverse/shared';

interface Props {
  onBack: () => void;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaPress: () => void;
  /** Replace default CTA button with custom content (e.g. Google Sign-In) */
  ctaContent?: ReactNode;
  /** Optional secondary action (e.g. "건너뛸래요" in step 3) */
  secondaryAction?: { label: string; onPress: () => void };
  /** Text below CTA (e.g. "성대생은 무료예요") */
  ctaFineprint?: string;
  /** Hide top bar (e.g. completion step has no back) */
  minimal?: boolean;
  children: ReactNode;
}

export function OnboardingLayout({
  onBack,
  ctaLabel,
  ctaDisabled = false,
  onCtaPress,
  ctaContent,
  secondaryAction,
  ctaFineprint,
  minimal = false,
  children,
}: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!minimal && (
        <View style={styles.topBar}>
          <IconButton
            icon={<CaretLeftIcon size={22} color={SdsColors.grey900} />}
            onPress={onBack}
            label="뒤로"
          />
        </View>
      )}

      <View style={styles.content}>{children}</View>

      <FixedBottomCTA flushOnKeyboard>
        {({ keyboardVisible }) => (
          <Fragment>
            {ctaContent ?? (
              <Button
                type="primary"
                size="big"
                display={keyboardVisible ? 'full' : 'block'}
                disabled={ctaDisabled}
                onPress={onCtaPress}
              >
                {ctaLabel}
              </Button>
            )}
            {secondaryAction && !keyboardVisible && (
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
            {ctaFineprint && !keyboardVisible && (
              <Txt typography="t7" color={SdsColors.grey400} style={styles.fineprint}>
                {ctaFineprint}
              </Txt>
            )}
          </Fragment>
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
