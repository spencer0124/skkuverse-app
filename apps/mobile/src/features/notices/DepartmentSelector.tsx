/**
 * Compact row showing selected department names.
 * Tapping opens the department picker sheet.
 */

import { Pressable, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { SdsColors, SdsSpacing } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface Props {
  label: string;
  onPress: () => void;
}

export function DepartmentSelector({ label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Txt
        typography="t6"
        fontWeight="semiBold"
        color={SdsColors.grey700}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Txt>
      <ChevronDown size={16} color={SdsColors.grey500} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    backgroundColor: SdsColors.background,
    gap: SdsSpacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
  },
});
