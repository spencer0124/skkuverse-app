/**
 * Opt-in sheet presented right after a picker confirm adds new items.
 *
 * Two layouts:
 *  - `addedIds.length === 1` — title + description + [Yes / Later] buttons.
 *    "Yes" resolves with the single id (express opt-in).
 *  - `addedIds.length >= 2` — title + checkbox list (default OFF) + [Confirm /
 *    Later] buttons. User must explicitly check items to subscribe them.
 *
 * Design axis: "picker edit ≠ subscription intent". Multi-mode defaults to
 * unchecked so subscription requires a deliberate tap per item. Single-mode
 * is a pragmatic exception — a 2-step dialog for one item feels excessive.
 *
 * Dismissal (swipe / backdrop tap / "Later") is a no-op — calls `onDismiss`
 * without invoking `onResolve`, so subscription state is untouched. The
 * parent clears its `pendingAdded` state regardless.
 */

import { forwardRef, useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import type { TabDepartment } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface Props {
  /** IDs that were just added to the picker selection and are candidates for subscription. */
  addedIds: string[];
  /** Department list from the parent picker tab — used to resolve display names. */
  departments: TabDepartment[];
  /** Called with the subset of ids the user opts into subscribing to. */
  onResolve: (subscribeIds: string[]) => void;
  /** Called when the sheet is dismissed without a resolve (swipe / backdrop). */
  onDismiss: () => void;
}

export const AddedItemsNotificationSheet = forwardRef<BottomSheetModal, Props>(
  function AddedItemsNotificationSheet(
    { addedIds, departments, onResolve, onDismiss },
    ref,
  ) {
    const { t, tpl } = useT();
    const [checked, setChecked] = useState<Set<string>>(() => new Set());

    // Reset checkbox state whenever the addedIds batch changes so a later
    // present() cycle doesn't carry residue from the previous session.
    useEffect(() => {
      setChecked(new Set());
    }, [addedIds]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      [],
    );

    const toggleChecked = useCallback((id: string) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }, []);

    const handleConfirmSingle = useCallback(() => {
      onResolve([addedIds[0]]);
    }, [addedIds, onResolve]);

    const handleConfirmMulti = useCallback(() => {
      onResolve(Array.from(checked));
    }, [checked, onResolve]);

    const singleMode = addedIds.length === 1;
    const singleName =
      singleMode
        ? departments.find((d) => d.id === addedIds[0])?.name ?? addedIds[0]
        : '';

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={singleMode ? ['40%'] : ['60%']}
        enableDynamicSizing={false}
        onDismiss={onDismiss}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetScrollView style={styles.content}>
          <Txt
            typography="t4"
            fontWeight="bold"
            color={SdsColors.grey900}
            style={styles.title}
          >
            {singleMode
              ? tpl('notifications.addedSheet.titleSingle', singleName)
              : t('notifications.addedSheet.titleMulti')}
          </Txt>
          <Txt
            typography="t6"
            color={SdsColors.grey500}
            style={styles.subtitle}
          >
            {singleMode
              ? t('notifications.addedSheet.descSingle')
              : t('notifications.addedSheet.descMulti')}
          </Txt>

          {!singleMode &&
            addedIds.map((id) => {
              const dept = departments.find((d) => d.id === id);
              const label = dept?.name ?? id;
              const selected = checked.has(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleChecked(id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected && styles.checkboxSelected,
                    ]}
                  >
                    {selected && (
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    )}
                  </View>
                  <Txt typography="t5" color={SdsColors.grey900}>
                    {label}
                  </Txt>
                </Pressable>
              );
            })}
        </BottomSheetScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.laterButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Txt typography="t5" fontWeight="semiBold" color={SdsColors.grey700}>
              {t('notifications.addedSheet.later')}
            </Txt>
          </Pressable>
          <Pressable
            onPress={singleMode ? handleConfirmSingle : handleConfirmMulti}
            disabled={!singleMode && checked.size === 0}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && styles.buttonPressed,
              !singleMode && checked.size === 0 && styles.confirmDisabled,
            ]}
          >
            <Txt typography="t5" fontWeight="semiBold" color="#FFFFFF">
              {singleMode
                ? t('notifications.addedSheet.confirmSingle')
                : t('notifications.addedSheet.confirmMulti')}
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
    flexDirection: 'row',
    padding: SdsSpacing.lg,
    paddingBottom: SdsSpacing.xxl,
    gap: SdsSpacing.sm,
  },
  laterButton: {
    flex: 1,
    backgroundColor: SdsColors.grey100,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: SdsColors.blue500,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
