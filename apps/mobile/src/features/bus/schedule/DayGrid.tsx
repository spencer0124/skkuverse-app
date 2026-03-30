/**
 * Day grid — fixed-width row of day cells for a single week.
 *
 * Design source: shuttle-v3.html (.days)
 * Replaces the old scrollable DaySelector with a non-scrolling flex grid.
 */

import { View, Pressable, StyleSheet } from 'react-native';
import { SdsColors, type DaySchedule } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

const DAY_NAMES: Record<number, string> = {
  1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일',
};

interface DayGridProps {
  days: DaySchedule[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function DayGrid({ days, selectedIndex, onSelect }: DayGridProps) {
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
              {DAY_NAMES[day.dayOfWeek] ?? String(day.dayOfWeek)}
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
