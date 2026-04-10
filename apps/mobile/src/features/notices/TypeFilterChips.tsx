import { View, Pressable, StyleSheet } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { NoticeSummaryType } from '@skkuverse/shared';

export type FilterValue = 'all' | NoticeSummaryType;

interface Props {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}

interface ChipDef {
  value: FilterValue;
  labelKey: 'notices.filterAll' | 'notices.filterAction' | 'notices.filterEvent' | 'notices.filterInfo';
}

const CHIPS: readonly ChipDef[] = [
  { value: 'all', labelKey: 'notices.filterAll' },
  { value: 'action_required', labelKey: 'notices.filterAction' },
  { value: 'event', labelKey: 'notices.filterEvent' },
  { value: 'informational', labelKey: 'notices.filterInfo' },
];

export function TypeFilterChips({ value, onChange }: Props) {
  const { t } = useT();
  return (
    <View style={styles.row}>
      {CHIPS.map((chip) => {
        const active = chip.value === value;
        return (
          <Pressable
            key={chip.value}
            onPress={() => onChange(chip.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Txt
              typography="t7"
              fontWeight={active ? 'semibold' : 'regular'}
              color={active ? SdsColors.background : SdsColors.grey700}
              numberOfLines={1}
              style={styles.chipLabel}
            >
              {t(chip.labelKey)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: SdsColors.grey900,
  },
  chipLabel: {
    flexShrink: 0,
    textAlign: 'center',
  },
});
