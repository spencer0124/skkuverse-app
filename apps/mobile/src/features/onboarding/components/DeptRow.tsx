import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors } from '@skkuverse/shared';

interface Props {
  name: string;
  selected: boolean;
  disabled?: boolean;
  variant: 'radio' | 'checkbox';
  onPress: () => void;
}

export function DeptRow({ name, selected, disabled = false, variant, onPress }: Props) {
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={variant}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={name}
    >
      <Txt
        typography="t6"
        fontWeight={selected ? 'semiBold' : 'medium'}
        color={
          disabled
            ? SdsColors.grey300
            : selected
              ? SdsColors.green500
              : SdsColors.grey900
        }
        style={styles.name}
      >
        {name}
      </Txt>
      <View
        style={[
          variant === 'radio' ? styles.radio : styles.checkbox,
          selected && styles.indicatorSelected,
          disabled && !selected && styles.indicatorDisabled,
        ]}
      >
        {selected && <Check size={10} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowSelected: {
    backgroundColor: SdsColors.green50,
  },
  name: {
    flex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: SdsColors.grey200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: SdsColors.grey200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSelected: {
    borderColor: SdsColors.green500,
    backgroundColor: SdsColors.green500,
  },
  indicatorDisabled: {
    borderColor: SdsColors.grey100,
    backgroundColor: SdsColors.grey50,
  },
});
