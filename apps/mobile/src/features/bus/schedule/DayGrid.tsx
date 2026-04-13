/**
 * Day grid — fixed-width row of day cells for a single week.
 *
 * Design source: shuttle-v3.html (.days)
 * Replaces the old scrollable DaySelector with a non-scrolling flex grid.
 */

import { View, Pressable, StyleSheet } from 'react-native';
import { SdsColors, useT, type DaySchedule , TranslationKey } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

const DAY_KEYS: Record<number, TranslationKey> = {
  1: 'day.mon', 2: 'day.tue', 3: 'day.wed', 4: 'day.thu', 5: 'day.fri', 6: 'day.sat', 7: 'day.sun',
};

interface DayGridProps {
  days: DaySchedule[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function DayGrid({ days, selectedIndex, onSelect }: DayGridProps) {
  const { t } = useT();
  return (
    <View style={styles.container}>
      {days.map((day, index) => {
        const isSelected = index === selectedIndex;
        const dayNumber = Number(day.date.split('-')[2]);

        return (
          <Pressable
            key={day.date}
            style={[styles.cell, isSelected && styles.cellSelected]}
            onPress={() => onSelect(index)}
          >
            <Txt
              typography="st10"
              fontWeight="bold"
              color={isSelected ? '#FFFFFF' : SdsColors.grey800}
              style={styles.number}
            >
              {String(dayNumber)}
            </Txt>
            <Txt
              typography="st13"
              fontWeight="medium"
              color={isSelected ? 'rgba(255,255,255,0.55)' : SdsColors.grey500}
            >
              {DAY_KEYS[day.dayOfWeek] ? t(DAY_KEYS[day.dayOfWeek]) : String(day.dayOfWeek)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    flex: 1,
    minWidth: 36,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 1,
  },
  cellSelected: {
    backgroundColor: SdsColors.grey900,
  },
  number: {
    lineHeight: 20,
  },
});
