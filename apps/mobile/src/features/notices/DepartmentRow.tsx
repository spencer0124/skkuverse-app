import { Pressable, View, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { Department } from '@skkuverse/shared';

interface Props {
  dept: Department;
  onPress: (dept: Department) => void;
}

export function DepartmentRow({ dept, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress(dept)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.textWrap}>
        <Txt typography="t4" fontWeight="semibold" color={SdsColors.grey900}>
          {dept.name}
        </Txt>
        {dept.campus ? (
          <Txt typography="t7" color={SdsColors.grey500} style={styles.campus}>
            {dept.campus.toUpperCase()}
          </Txt>
        ) : null}
      </View>
      <ChevronRight size={20} color={SdsColors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: SdsColors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: SdsColors.grey100,
  },
  rowPressed: {
    backgroundColor: SdsColors.grey50,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  campus: {
    letterSpacing: 0.5,
  },
});
