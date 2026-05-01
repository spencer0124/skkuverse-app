import { Text, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SparkleIcon } from 'phosphor-react-native';
import { Txt, TextButton } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';

interface Props {
  onStartPress: () => void;
  onExistingAccountPress: () => void;
  /** Disable both CTAs while a sign-in flow is in flight (prevents double-tap). */
  loading?: boolean;
  /** Inline error message (e.g. domain not allowed, network failure). */
  signInError?: string | null;
}

// v2 redesign: top-aligned headline + centered mock notice card preview +
// dark-green CTA. Mock card content is intentionally hardcoded Korean — the
// landing exists to demo "AI가 핵심만 요약" before sign-in, so picking one
// rich example (장학금 D-3) communicates the value better than a generic
// placeholder. Globalize via i18n keys when launching outside KR.
export function OnboardingLanding({
  onStartPress,
  onExistingAccountPress,
  loading = false,
  signInError = null,
}: Props) {
  const { t } = useT();
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View>
          <Text style={styles.headline}>긴 공지도</Text>
          <Text style={styles.headline}>30초면 끝</Text>
          <Text style={styles.subtitle}>AI가 핵심만 뽑아서 정리해드려요</Text>
        </View>

        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <View style={styles.cardMeta}>
              <Text style={styles.cardDept}>교무팀</Text>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>D-3</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>
              2026학년도 1학기 복수전공 이수신청
            </Text>
            <View style={styles.aiBox}>
              <View style={styles.aiHeader}>
                <SparkleIcon size={11} color="#1f3d2e" weight="regular" />
                <Text style={styles.aiLabel}>AI 요약</Text>
              </View>
              <Text style={styles.aiBody}>
                4/24까지 1차 신청, GLS에서 진행
              </Text>
            </View>
            <View style={styles.detailRows}>
              <DetailRow label="신청기간" value="4/20 ~ 4/24" />
              <DetailRow label="대상" value="재학생·휴학생" />
              <DetailRow label="해야 할 일" value="GLS에서 신청" />
            </View>
          </View>
        </View>

        <View>
          <Pressable
            onPress={onStartPress}
            disabled={loading}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              loading && styles.ctaDisabled,
            ]}
          >
            <Text style={styles.ctaText}>{t('onboarding.landingCta')}</Text>
          </Pressable>
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
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
    paddingBottom: 24,
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
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardDept: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1f3d2e',
  },
  cardBadge: {
    backgroundColor: '#fef2f2',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 5,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#b91c1c',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 12,
    lineHeight: 20,
  },
  aiBox: {
    backgroundColor: '#f0f7f4',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  aiLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#1f3d2e',
  },
  aiBody: {
    fontSize: 11,
    color: '#2c2c2c',
    lineHeight: 17,
  },
  detailRows: {
    paddingTop: 4,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#9a9a9a',
    minWidth: 56,
    lineHeight: 15,
  },
  detailValue: {
    fontSize: 11,
    color: '#2c2c2c',
    lineHeight: 15,
  },
  cta: {
    width: '100%',
    height: 56,
    backgroundColor: '#1f3d2e',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
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
