import { type ReactNode, forwardRef, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Sheet, Txt, type SheetRef } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

/**
 * Review-prompt sheet — the "Toss-style soft gate" that filters review
 * prompts before they reach the OS quota. Generic across surfaces.
 * User taps 👍 → parent invokes native StoreReview. User taps 👎 → parent
 * opens NegativeFeedbackSheet. User dismisses → onDismiss fires.
 *
 * Does NOT call any analytics — the parent (useReviewPrompt orchestration
 * hook) owns funnel logging so dismiss vs explicit choice can be accurately
 * distinguished.
 */
type Props = {
  /** Surface-specific icon rendered in the green circle (e.g. BookmarkSimpleIcon). */
  icon: ReactNode;
  /** Surface-specific title text. */
  title: string;
  onPositive: () => void;
  onNegative: () => void;
  /** Fires for any close path — used by parent to track 'dismissed'. */
  onDismiss: () => void;
};

export const ReviewPromptSheet = forwardRef<SheetRef, Props>(
  function ReviewPromptSheet({ icon, title, onPositive, onNegative, onDismiss }, parentRef) {
    const { t } = useT();
    const sheetRef = useRef<SheetRef>(null);
    const setRefs = useCallback(
      (node: SheetRef | null) => {
        sheetRef.current = node;
        if (typeof parentRef === 'function') parentRef(node);
        else if (parentRef) parentRef.current = node;
      },
      [parentRef],
    );

    const handlePositive = () => {
      sheetRef.current?.dismiss?.();
      onPositive();
    };

    const handleNegative = () => {
      sheetRef.current?.dismiss?.();
      onNegative();
    };

    return (
      <Sheet
        ref={setRefs}
        // Sized to the prompt rather than to a percentage. The 38% this used to
        // carry was a stand-in for "as tall as an icon, a line of text and two
        // buttons", which is what `fit` says outright.
        position={{ kind: 'fit' }}
        onDismiss={onDismiss}
      >
        <Sheet.View style={styles.content}>
          <View style={styles.iconCircle}>
            {icon}
          </View>
          <Txt
            typography="t2"
            fontWeight="bold"
            color={SdsColors.grey900}
            style={styles.title}
          >
            {title}
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
                {t('feedback.reviewPrompt.negativeCta')}
              </Button>
            </View>
            <View style={styles.actionItem}>
              <Button
                type="primary"
                size="big"
                display="block"
                onPress={handlePositive}
              >
                {t('feedback.reviewPrompt.positiveCta')}
              </Button>
            </View>
          </View>
        </Sheet.View>
      </Sheet>
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
