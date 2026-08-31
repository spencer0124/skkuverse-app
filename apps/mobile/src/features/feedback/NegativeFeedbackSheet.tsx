import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, Sheet, TextField, Txt, type SheetRef } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

const FEEDBACK_TEXT_MAX = 1500;

/**
 * Stage 2b sheet — collects qualitative feedback from the user who tapped
 * "아쉬워요". Empty submit is allowed (the very act of choosing 👎 is
 * already signal); text is optional context. Parent owns the actual
 * submission (Firestore write + thanks-dialog).
 */
type Props = {
  isSubmitting: boolean;
  onSubmit: (text: string) => void;
  /** Pure dismiss path (swipe close without explicit submit). */
  onDismiss: () => void;
};

export const NegativeFeedbackSheet = forwardRef<SheetRef, Props>(
  function NegativeFeedbackSheet({ isSubmitting, onSubmit, onDismiss }, parentRef) {
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
    const [text, setText] = useState('');

    const handleSubmit = () => {
      const trimmed = text.trim().slice(0, FEEDBACK_TEXT_MAX);
      onSubmit(trimmed);
      // Parent calls dismiss() on this ref after submission completes.
    };

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'stuck', detent: 'medium' }}
        // A text input wants the content to shrink around the keyboard rather
        // than slide under it.
        androidKeyboardInputMode="adjustResize"
        onDismiss={() => {
          // Reset for next session — parent may reopen with the same uid.
          setText('');
          onDismiss();
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Sheet.ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Txt
              typography="t3"
              fontWeight="bold"
              color={SdsColors.grey900}
              style={styles.title}
            >
              {t('feedback.reviewPrompt.negativePlaceholder')}
            </Txt>
            <View style={styles.inputWrap}>
              <TextField
                variant="box"
                label={t('feedback.reviewPrompt.negativePlaceholder')}
                value={text}
                onChangeText={(next) => setText(next.slice(0, FEEDBACK_TEXT_MAX))}
                multiline
                maxLength={FEEDBACK_TEXT_MAX}
              />
            </View>
            <View style={styles.actions}>
              <Button
                type="primary"
                size="big"
                display="block"
                disabled={isSubmitting}
                onPress={handleSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  t('feedback.reviewPrompt.negativeSubmit')
                )}
              </Button>
            </View>
          </Sheet.ScrollView>
        </TouchableWithoutFeedback>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.xl,
    paddingTop: SdsSpacing.lg,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: {
    marginBottom: SdsSpacing.lg,
  },
  inputWrap: {
    marginBottom: SdsSpacing.xl,
  },
  actions: {
    marginTop: 'auto',
  },
});
