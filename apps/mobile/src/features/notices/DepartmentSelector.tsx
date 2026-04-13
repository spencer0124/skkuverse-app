/**
 * Compact row showing selected department names.
 * Tapping opens the department picker sheet.
 */

import { Pressable, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { SdsColors } from '@skkuverse/shared';
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
        typography="t7"
        color={SdsColors.grey500}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Txt>
      <ChevronDown size={14} color={SdsColors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SdsColors.grey50,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F3F5',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
  },
});
