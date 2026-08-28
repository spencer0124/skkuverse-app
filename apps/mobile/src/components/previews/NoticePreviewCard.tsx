import { StyleSheet, Text, View } from 'react-native';
import { SparkleIcon } from 'phosphor-react-native';

import { previewBrand, previewCard } from './styles';

/**
 * Mock notice card — the "AI가 핵심만 요약" demo shown before sign-in.
 *
 * Extracted from OnboardingLanding so the notices gate and the first-launch
 * intro render one definition instead of two drifting copies.
 *
 * Content is intentionally hardcoded Korean. The card exists to demonstrate the
 * summary shape, and one rich real example (장학금 D-3) sells it better than a
 * generic placeholder would. Globalize when launching outside KR — the
 * surrounding headlines and CTAs are already i18n'd.
 */
export function NoticePreviewCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDept}>교무팀</Text>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>D-3</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>2026학년도 1학기 복수전공 이수신청</Text>
      <View style={styles.aiBox}>
        <View style={styles.aiHeader}>
          <SparkleIcon size={11} color={previewBrand.green} weight="regular" />
          <Text style={styles.aiLabel}>AI 요약</Text>
        </View>
        <Text style={styles.aiBody}>4/24까지 1차 신청, GLS에서 진행</Text>
      </View>
      <View style={styles.detailRows}>
        <DetailRow label="신청기간" value="4/20 ~ 4/24" />
        <DetailRow label="대상" value="재학생·휴학생" />
        <DetailRow label="해야 할 일" value="GLS에서 신청" />
      </View>
    </View>
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
  card: previewCard,
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardDept: {
    fontSize: 11,
    fontWeight: '500',
    color: previewBrand.green,
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
    color: previewBrand.ink,
    marginBottom: 12,
    lineHeight: 20,
  },
  aiBox: {
    backgroundColor: previewBrand.greenTint,
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
    color: previewBrand.green,
  },
  aiBody: {
    fontSize: 11,
    color: previewBrand.body,
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
    color: previewBrand.muted,
    minWidth: 56,
    lineHeight: 15,
  },
  detailValue: {
    fontSize: 11,
    color: previewBrand.body,
    lineHeight: 15,
  },
});
