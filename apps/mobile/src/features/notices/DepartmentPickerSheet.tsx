/**
 * Multi-select bottom sheet for choosing departments (max 3).
 *
 * Uses internal pending state — changes are committed on "완료" press.
 * Backdrop dismiss rolls back to the previous selection.
 */

import { forwardRef, useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import type { Department } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

const MAX_SELECTED = 3;

interface Props {
  departments: Department[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
}

export const DepartmentPickerSheet = forwardRef<BottomSheetModal, Props>(
  function DepartmentPickerSheet({ departments, selectedIds, onConfirm }, ref) {
    const { t, tpl } = useT();
    const [pending, setPending] = useState<string[]>(selectedIds);

    const handleChange = useCallback(
      (index: number) => {
        // Reset pending to current selection whenever sheet opens
        if (index >= 0) setPending(selectedIds);
      },
      [selectedIds],
    );

    const handleToggle = useCallback((deptId: string) => {
      setPending((prev) => {
        if (prev.includes(deptId)) {
          // Enforce min 1
          if (prev.length <= 1) return prev;
          return prev.filter((id) => id !== deptId);
        }
        // Enforce max 3
        if (prev.length >= MAX_SELECTED) return prev;
        return [...prev, deptId];
      });
    }, []);

    const handleConfirm = useCallback(() => {
      onConfirm(pending);
      (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
    }, [pending, onConfirm, ref]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['50%']}
        enableDynamicSizing={false}
        onChange={handleChange}
      >
        <BottomSheetScrollView style={styles.content}>
          <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
            {t('notices.selectDept')}
          </Txt>
          <Txt typography="t7" color={SdsColors.grey500} style={styles.subtitle}>
            {tpl('notices.selectDeptMax', MAX_SELECTED)}
          </Txt>

          {departments.map((dept) => {
            const selected = pending.includes(dept.id);
            const disabled = !selected && pending.length >= MAX_SELECTED;
            return (
              <Pressable
                key={dept.id}
                onPress={() => handleToggle(dept.id)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  disabled && styles.rowDisabled,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    selected && styles.checkboxSelected,
                  ]}
                >
                  {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Txt
                  typography="t5"
                  color={disabled ? SdsColors.grey300 : SdsColors.grey900}
                >
                  {dept.name}
                </Txt>
              </Pressable>
            );
          })}
        </BottomSheetScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && styles.confirmPressed,
            ]}
          >
            <Txt typography="t5" fontWeight="semiBold" color="#FFFFFF">
              {t('notices.done')}
            </Txt>
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.lg,
  },
  title: {
    marginBottom: SdsSpacing.xs,
  },
  subtitle: {
    marginBottom: SdsSpacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: SdsSpacing.md,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: SdsColors.grey300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: SdsColors.blue500,
    borderColor: SdsColors.blue500,
  },
  footer: {
    padding: SdsSpacing.lg,
    paddingBottom: SdsSpacing.xxl,
  },
  confirmButton: {
    backgroundColor: SdsColors.blue500,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmPressed: {
    opacity: 0.85,
  },
});
