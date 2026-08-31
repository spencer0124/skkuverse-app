/**
 * The explicit close control every modal sheet on the map carries.
 *
 * A sheet that can only be dragged away is a sheet that looks stuck to anyone
 * who does not know the gesture, so each one pins an X in a header row above
 * its scroll view — a sibling of the content, never its first row, or it would
 * ride up and out of reach the moment the content grew past the sheet. Closing
 * has to stay one tap away at every scroll position.
 *
 * Its own component because `useBottomSheetModal()` reads context the modal
 * provides: calling it in the sheet component itself, which renders that
 * modal, would read from outside its own provider. `dismiss()` with no key
 * closes the top-most modal in the provider's queue, which is the sheet this
 * button sits in whenever it is being pressed.
 */

import { Pressable, StyleSheet } from 'react-native';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import { XIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';

export function SheetCloseButton({ label }: { label: string }) {
  const { dismiss } = useBottomSheetModal();
  return (
    <Pressable
      onPress={() => dismiss()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.close}
    >
      <XIcon size={18} color={SdsColors.grey700} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
