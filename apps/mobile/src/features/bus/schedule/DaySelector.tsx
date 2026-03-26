/**
 * Day selector — row of date chips for switching schedule days.
 *
 * Selected day: brand color background. Today: dot indicator.
 * Hidden days: disabled/greyed out.
 *
 * Flutter source: bus_campus_screen.dart (day selector)
 */

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SdsColors, SdsRadius, type DaySchedule } from '@skkuuniverse/shared';

interface DaySelectorProps {
  days: DaySchedule[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  todayDate?: string;
}

export function DaySelector({
  days,
  selectedIndex,
  onSelect,
  todayDate,
}: DaySelectorProps) {
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

        return (
          <Pressable
            key={day.date}
            style={[
              styles.chip,
              isSelected && (isNoService ? styles.chipSelectedNoService : styles.chipSelected),
              isHidden && styles.chipDisabled,
            ]}
            onPress={() => !isHidden && onSelect(index)}
            disabled={isHidden}
          >
            <Text
              style={[
                styles.dayOfWeek,
                isNoService && !isSelected && styles.textNoService,
                isSelected && styles.textSelected,
                isHidden && styles.textDisabled,
                isToday && !isSelected && !isNoService && styles.textToday,
              ]}
            >
              {day.dayOfWeek}
            </Text>
            <Text
              style={[
                styles.dateText,
                isNoService && !isSelected && styles.textNoService,
                isSelected && styles.textSelected,
                isHidden && styles.textDisabled,
                isToday && !isSelected && !isNoService && styles.textToday,
              ]}
            >
              {day.date.slice(8)} {/* DD from YYYY-MM-DD */}
            </Text>
            {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: SdsRadius.sm,
    alignItems: 'center',
    gap: 2,
  },
  chipSelected: {
    backgroundColor: SdsColors.brand,
  },
  chipSelectedNoService: {
    backgroundColor: SdsColors.grey300,
  },
  chipDisabled: {
    opacity: 0.3,
  },
  dayOfWeek: {
    fontSize: 11,
    fontWeight: '600',
    color: SdsColors.grey600,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  textSelected: {
    color: SdsColors.background,
  },
  textNoService: {
    color: SdsColors.grey300,
  },
  textToday: {
    color: SdsColors.brand,
  },
  textDisabled: {
    color: SdsColors.grey400,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SdsColors.brand,
  },
  todayDotSelected: {
    backgroundColor: SdsColors.background,
  },
});
