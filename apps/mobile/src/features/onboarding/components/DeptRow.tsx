import { Pressable, StyleSheet, View } from 'react-native';
import { CheckIcon, WarningCircleIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors } from '@skkuverse/shared';

interface Props {
  name: string;
  selected: boolean;
  /** Hard-disable: row is greyed out and onPress is suppressed entirely. */
  disabled?: boolean;
  /**
   * Soft-disable: row is greyed out but onPress still fires — used for
   * intentionally-unsupported depts so the caller can open an explanation
   * sheet on tap.
   */
  unsupported?: boolean;
  variant: 'radio' | 'checkbox';
  onPress: () => void;
}

export function DeptRow({
  name,
  selected,
  disabled = false,
  unsupported = false,
  variant,
  onPress,
}: Props) {
  const dimmed = disabled || unsupported;
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
          dimmed
            ? SdsColors.grey300
            : selected
              ? '#1f3d2e'
              : SdsColors.grey900
        }
        style={styles.name}
      >
        {name}
      </Txt>
      {unsupported && (
        // Tap-to-explain affordance: without a visible marker a greyed row
        // reads as "broken / doesn't exist", not "tap to learn why".
        <WarningCircleIcon
          size={16}
          color={SdsColors.grey400}
          weight="fill"
          style={styles.warnIcon}
        />
      )}
      <View
        style={[
          variant === 'radio' ? styles.radio : styles.checkbox,
          selected && styles.indicatorSelected,
          dimmed && !selected && styles.indicatorDisabled,
        ]}
      >
        {selected && <CheckIcon size={10} color="#FFFFFF" />}
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
  warnIcon: {
    marginRight: 8,
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
    borderColor: '#1f3d2e',
    backgroundColor: '#1f3d2e',
  },
  indicatorDisabled: {
    borderColor: SdsColors.grey100,
    backgroundColor: SdsColors.grey50,
  },
});
