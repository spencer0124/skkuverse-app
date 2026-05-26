/**
 * HomeOnboardingGateCard — 홈 화면의 미니 온보딩 게이트.
 *
 * 공지 탭의 풀스크린 OnboardingLanding과 동일한 hook 카피("성균관대 공지, 찾지 말고 받아보세요")를
 * 홈의 좁은 카드 자리(DeptNoticesSection 슬롯)에 축약한 형태. 진입점은 같이
 * `/onboarding` 모달이라 NoticesTab과 흐름이 일치한다.
 */
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SdsShadows, useT } from '@skkuverse/shared';
import { logHomeContentSelect } from '@/services/analytics';

export function HomeOnboardingGateCard() {
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={styles.section}>
      <Text style={styles.headline}>{t('home.onboardingGate.headline')}</Text>
      <Text style={styles.subtitle}>{t('home.onboardingGate.subtitle')}</Text>
      <Pressable
        onPress={() => {
          logHomeContentSelect({ content_type: 'onboarding_cta', item_id: 'start' });
          if (Platform.OS === 'android') {
            Alert.alert(
              t('onboarding.androidSignupBlockedTitle'),
              t('onboarding.androidSignupBlockedMessage'),
            );
            return;
          }
          router.push('/onboarding');
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('home.onboardingGate.ctaAccessibility')}
      >
        <Text style={styles.ctaText}>{t('onboarding.landingCta')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    boxShadow: SdsShadows.card.boxShadow,
    ...SdsShadows.card.legacy,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.5,
    color: '#000',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b6b',
    lineHeight: 20,
    marginBottom: 22,
  },
  cta: {
    backgroundColor: '#1f3d2e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
