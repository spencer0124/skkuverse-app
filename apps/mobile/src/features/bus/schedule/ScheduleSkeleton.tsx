/**
 * Schedule screen loading skeleton — matches section card layout.
 *
 * Grey50 background with white section cards (controls + timetable).
 */

import { View, StyleSheet } from 'react-native';
import { SdsColors, SdsRadius } from '@skkuverse/shared';
import { Skeleton } from '@skkuverse/sds';

export function ScheduleSkeleton() {
  return (
    <Skeleton.Animate>
      <View style={styles.container}>
        {/* Controls section card */}
        <View style={styles.controlsCard}>
          {/* SegmentedControl placeholder */}
          <Skeleton width="100%" height={36} borderRadius={10} />

          {/* Week header placeholder */}
          <View style={styles.weekHeader}>
            <Skeleton width={90} height={16} borderRadius={SdsRadius.xs} />
            <View style={styles.weekNav}>
              <Skeleton width={28} height={28} borderRadius={8} />
              <Skeleton width={28} height={28} borderRadius={8} />
            </View>
          </View>

          {/* DayGrid placeholder — 7 day cells */}
          <View style={styles.dayGrid}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={styles.dayCell}>
                <Skeleton width={20} height={16} borderRadius={SdsRadius.xs} />
                <Skeleton width={14} height={12} borderRadius={SdsRadius.xs} />
              </View>
            ))}
          </View>
        </View>

        {/* Timetable section card */}
        <View style={styles.timetableCard}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={styles.scheduleRow}>
              <Skeleton width={8} height={8} borderRadius={4} />
              <Skeleton width={60} height={16} borderRadius={SdsRadius.xs} />
            </View>
          ))}
        </View>
      </View>
    </Skeleton.Animate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
  },
  controlsCard: {
    backgroundColor: SdsColors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 10,
  },
  weekNav: {
    flexDirection: 'row',
    gap: 2,
  },
  dayGrid: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  timetableCard: {
    backgroundColor: SdsColors.background,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
});
