/**
 * Day selector — row of date chips for switching schedule days.
 *
 * Flutter source: bus_campus_screen.dart (day selector, lines 299-422)
 *
 * Key behaviors:
 * - If ANY day has a label, ALL chips reserve label space (transparent text)
 * - Hidden days: opacity 0.5, disabled
 * - Today indicator: 4x4 dot below date (only when not selected)
 * - Date format: "M/D" (not zero-padded)
 */

import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SdsColors, useT, type DaySchedule, type TranslationKey } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

/** 1=Mon through 7=Sun → translation key */
const DAY_KEYS: Record<number, TranslationKey> = {
  1: 'day.mon',
  2: 'day.tue',
  3: 'day.wed',
  4: 'day.thu',
  5: 'day.fri',
  6: 'day.sat',
  7: 'day.sun',
};

/** Flutter color constants */
const HERO_GREEN = SdsColors.brand;
const GREY = '#9EA4AA';
const GREY_LIGHT = '#C9CDD2';
const GREY_BG = '#F5F6F8';

interface DaySelectorProps {
  days: DaySchedule[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  todayDate?: string;
}

/** Format "YYYY-MM-DD" → "M/D" (no zero-pad, matching Flutter) */
function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function DaySelector({
  days,
  selectedIndex,
  onSelect,
  todayDate,
}: DaySelectorProps) {
  const { t } = useT();
  // If any day has a label, all chips reserve label space
  const hasAnyLabel = days.some((d) => d.label != null);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {days.map((day, index) => {
        const isSelected = index === selectedIndex;
        const isToday = day.date === todayDate;
        const isHidden = day.display === 'hidden';
        const isNoService = day.display === 'noService';

        // Chip background
        const chipBg = isSelected
          ? isNoService
            ? GREY_LIGHT
            : HERO_GREEN
          : GREY_BG;

        // Text color logic (Flutter lines 350-370)
        const chipTextColor = isHidden
          ? GREY_LIGHT + '80' // alpha 0.5
          : isSelected
            ? SdsColors.background
            : isNoService
              ? GREY_LIGHT
              : isToday
                ? HERO_GREEN
                : GREY;

        const dateTextColor = isHidden
          ? GREY_LIGHT + '80'
          : isSelected
            ? SdsColors.background
            : isNoService
              ? GREY_LIGHT
              : isToday
                ? HERO_GREEN
                : GREY;

        const fontWeight = (isSelected || isToday ? 'bold' : 'regular') as 'bold' | 'regular';

        return (
          <Pressable
            key={day.date}
            style={[
              styles.chip,
              { backgroundColor: chipBg },
              isHidden && styles.chipHidden,
            ]}
            onPress={() => !isHidden && onSelect(index)}
            disabled={isHidden}
          >
            {/* Date: "M/D" */}
            <Txt typography="t7" fontWeight={fontWeight} color={dateTextColor}>
              {formatShortDate(day.date)}
            </Txt>

            {/* Day name: "월", "화", ... */}
            <Txt typography="st11" fontWeight={fontWeight} color={chipTextColor}>
              {DAY_KEYS[day.dayOfWeek] ? t(DAY_KEYS[day.dayOfWeek]) : String(day.dayOfWeek)}
            </Txt>

            {/* Today indicator dot (only when not selected) */}
            {isToday && !isSelected && <View style={styles.todayDot} />}

            {/* Label line — reserve space if any day has label */}
            {hasAnyLabel && (
              <Txt
                typography="st13"
                color={
                  day.label != null
                    ? isSelected
                      ? 'rgba(255,255,255,0.7)'
                      : GREY
                    : 'transparent'
                }
                numberOfLines={1}
                style={{ fontSize: 8, lineHeight: 12 }}
              >
                {day.label ?? ''}
              </Txt>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 4,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: 2,
    borderRadius: 10,
    alignItems: 'center',
    gap: 2,
  },
  chipHidden: {
    opacity: 0.5,
  },
  todayDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: HERO_GREEN,
  },
});
