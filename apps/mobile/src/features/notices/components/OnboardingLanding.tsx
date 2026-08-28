import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Button, Txt, TextButton } from '@skkuverse/sds';
import { SdsColors, useAuthStore, useT } from '@skkuverse/shared';
import { NoticePreviewCard } from '@/components/previews';
import { logNoticesContentSelect } from '@/services/analytics';

// iOS 26+ NativeTabs uses a floating Liquid Glass capsule that is NOT
// included in safeAreaInsets (UITabBarController auto-inset path doesn't
// apply to the floating overlay). Earlier iOS / Android use JSX <Tabs>
// whose tab bar height IS in insets, so the extra absorption is unwanted.
// Module-scope per project idiom (see (tabs)/_layout.tsx).
const GLASS_AVAILABLE = isLiquidGlassAvailable();

interface Props {
  onStartPress: () => void;
  onExistingAccountPress: () => void;
  /** Disable both CTAs while a sign-in flow is in flight (prevents double-tap). */
  loading?: boolean;
  /** Inline error message (e.g. domain not allowed, network failure). */
  signInError?: string | null;
}

// v2 redesign: top-aligned headline + centered mock notice card preview +
// dark-green CTA. The card itself is `NoticePreviewCard`, shared with the
// first-launch intro's notices page so the two surfaces cannot drift; the
// reasoning for its hardcoded Korean lives with the component.
export function OnboardingLanding({
  onStartPress,
  onExistingAccountPress,
  loading = false,
  signInError = null,
}: Props) {
  const { t } = useT();
  // "이미 가입한 적 있어요" only makes sense for someone who has not signed in.
  // The first-launch intro can leave a user signed-in but not yet onboarded
  // (isAnonymous false, onboardingCompleted false), and this gate still shows
  // for them — tapping the link there would run a second, pointless
  // signInWithDeviceMigration against the account they are already on.
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View>
          <Text style={styles.headline}>성균관대 공지,</Text>
          <Text style={styles.headline}>찾지 말고 받아보세요</Text>
          <Text style={styles.subtitle}>AI가 중요한 내용만 알려드려요</Text>
        </View>

        <View style={styles.cardWrapper}>
          <NoticePreviewCard />
        </View>

        <View>
          <Button
            type="primary"
            size="big"
            display="block"
            onPress={() => {
              logNoticesContentSelect({ content_type: 'onboarding_landing_cta', item_id: 'start' });
              onStartPress();
            }}
            disabled={loading}
          >
            {t('onboarding.landingCta')}
          </Button>
          {isAnonymous ? (
            <TextButton
              typography="t6"
              color={SdsColors.grey400}
              fontWeight="medium"
              onPress={() => {
                logNoticesContentSelect({ content_type: 'onboarding_landing_signin', item_id: 'existing' });
                onExistingAccountPress();
              }}
              disabled={loading}
              style={styles.existingAccountButton}
            >
              {t('onboarding.landingExistingAccountCta')}
            </TextButton>
          ) : null}
          {signInError ? (
            <Txt typography="t7" color={SdsColors.red500} style={styles.error}>
              {signInError}
            </Txt>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 24,
    // iOS 26+ NativeTabs floating capsule만 명시 흡수, 그 외 OS는 standard
    // tab bar가 safeAreaInsets에 포함되므로 24면 충분 (자세한 배경은 위
    // GLASS_AVAILABLE 주석 참조).
    paddingBottom: GLASS_AVAILABLE ? 80 : 24,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.7,
    color: '#000',
  },
  subtitle: {
    fontSize: 18,
    color: '#6b6b6b',
    marginTop: 16,
    lineHeight: 26,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  existingAccountButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  error: {
    textAlign: 'center',
    marginTop: 8,
  },
});
