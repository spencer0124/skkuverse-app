/**
 * HomeOnboardingGateCard — 홈 화면의 미니 온보딩 게이트.
 *
 * 공지 탭의 풀스크린 OnboardingLanding과 동일한 hook 카피("긴 공지도 30초면 끝")를
 * 홈의 좁은 카드 자리(DeptNoticesSection 슬롯)에 축약한 형태. 진입점은 같이
 * `/onboarding` 모달이라 NoticesTab과 흐름이 일치한다.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SdsShadows } from '@skkuverse/shared';

export function HomeOnboardingGateCard() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.headline}>긴 공지도{'\n'}30초면 끝</Text>
      <Text style={styles.subtitle}>AI가 핵심만 뽑아서 정리해드려요</Text>
      <Pressable
        onPress={() => router.push('/onboarding')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="공지 온보딩 시작하기"
      >
        <Text style={styles.ctaText}>시작하기</Text>
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
