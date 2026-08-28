import { StyleSheet, Text, View } from 'react-native';
import { ArrowRightIcon, BusIcon } from 'phosphor-react-native';

import { previewBrand, previewCard } from './styles';

/**
 * Mock shuttle card for the first-launch intro's shuttle page.
 *
 * Mirrors the schedule screen's hero: the "다음 셔틀 + N분 후" pairing is the
 * single most useful thing the transit tab answers, so the mock leads with it
 * rather than showing a full timetable.
 *
 * Hardcoded Korean by the same reasoning as NoticePreviewCard.
 */
const UPCOMING = ['12:04', '12:19', '12:34'];

export function ShuttlePreviewCard() {
  return (
    <View style={styles.card}>
      <View style={styles.route}>
        <BusIcon size={13} color={previewBrand.green} weight="fill" />
        <Text style={styles.routeText}>인사캠</Text>
        <ArrowRightIcon size={11} color={previewBrand.muted} weight="bold" />
        <Text style={styles.routeText}>자과캠</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>다음 셔틀</Text>
        <View style={styles.heroValue}>
          <Text style={styles.heroNumber}>3</Text>
          <Text style={styles.heroUnit}>분 후</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {UPCOMING.map((time, index) => (
          <View
            key={time}
            style={[styles.chip, index === 0 && styles.chipActive]}
          >
            <Text style={[styles.chipText, index === 0 && styles.chipTextActive]}>
              {time}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>지금 2대 운행 중</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: previewCard,
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 14,
  },
  routeText: {
    fontSize: 11,
    fontWeight: '500',
    color: previewBrand.green,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 13,
    color: previewBrand.muted,
  },
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  heroNumber: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.6,
    color: previewBrand.ink,
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: previewBrand.ink,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
  },
  chipActive: {
    backgroundColor: previewBrand.greenTint,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: previewBrand.muted,
  },
  chipTextActive: {
    color: previewBrand.green,
  },
  footer: {
    fontSize: 11,
    color: previewBrand.body,
  },
});
