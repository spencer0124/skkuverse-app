import { forwardRef, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { BookmarkSimpleIcon } from 'phosphor-react-native';
import { Button, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

/**
 * Review-prompt sheet — the "Toss-style soft gate" that filters review
 * prompts before they reach the OS quota. Shown on the user's 2nd+ bookmark.
 * User taps 👍 → parent invokes native StoreReview. User taps 👎 → parent
 * opens NegativeFeedbackSheet. User dismisses (swipe / backdrop) → onDismiss
 * fires with no explicit choice.
 *
 * The component does NOT call any analytics itself — the parent
 * (NoticeDetailScreen) owns the funnel logging so dismiss vs explicit
 * choice can be distinguished accurately (BottomSheetModal `onDismiss`
 * fires for both swipe-dismiss AND programmatic dismiss).
 */
type Props = {
  onPositive: () => void;
  onNegative: () => void;
  /** Fires for any close path — used by parent to track 'dismissed' if no
   *  explicit positive/negative was recorded first. */
  onDismiss: () => void;
};

export const ReviewPromptSheet = forwardRef<BottomSheetModal, Props>(
  function ReviewPromptSheet(
    { onPositive, onNegative, onDismiss },
    parentRef,
  ) {
    const { t } = useT();
    const sheetRef = useRef<BottomSheetModal>(null);
    const setRefs = useCallback(
      (node: BottomSheetModal | null) => {
        sheetRef.current = node;
        if (typeof parentRef === 'function') parentRef(node);
        else if (parentRef) parentRef.current = node;
      },
      [parentRef],
    );

    const handlePositive = () => {
      sheetRef.current?.dismiss();
      onPositive();
    };

    const handleNegative = () => {
      sheetRef.current?.dismiss();
      onNegative();
    };

    return (
      <BottomSheetModal
        ref={setRefs}
        snapPoints={['38%']}
        enableDynamicSizing={false}
        onDismiss={onDismiss}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.iconCircle}>
            <BookmarkSimpleIcon size={32} color="#1f3d2e" weight="fill" />
          </View>
          <Txt
            typography="t2"
            fontWeight="bold"
            color={SdsColors.grey900}
            style={styles.title}
          >
            {t('notices.reviewPrompt.title')}
          </Txt>
          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button
                type="dark"
                style="weak"
                size="big"
                display="block"
                onPress={handleNegative}
              >
                {t('notices.reviewPrompt.negativeCta')}
              </Button>
            </View>
            <View style={styles.actionItem}>
              <Button
                type="primary"
                size="big"
                display="block"
                onPress={handlePositive}
              >
                {t('notices.reviewPrompt.positiveCta')}
              </Button>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.xl,
    paddingTop: SdsSpacing.lg,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e8f3ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SdsSpacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: SdsSpacing.xl,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  actionItem: {
    flex: 1,
  },
});
