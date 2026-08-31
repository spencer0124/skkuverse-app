import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, Checkbox, Sheet, TextField, Txt, type SheetRef } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import type { DeleteAccountFeedback } from '@/services/delete-account';

const REASONS = [
  'not_used',
  'too_many_notifs',
  'no_value',
  'bugs',
  'other',
] as const;
type Reason = (typeof REASONS)[number];

const OTHER_TEXT_MAX = 500;

type Props = {
  isSubmitting: boolean;
  onSubmit: (feedback?: DeleteAccountFeedback) => void;
};

/**
 * Optional survey shown after the user confirms deletion. Submits anonymously
 * — the Cloud Function stores no uid on the recorded document.
 *
 * "Skip and delete" still triggers the same destructive flow, so both buttons
 * are wired through `onSubmit` (the parent's deletion orchestrator). The CF
 * input validator silently drops empty `reasons` + missing `otherText`, so
 * passing `undefined` here is the canonical "no feedback" path.
 */
export const DeleteAccountFeedbackSheet = forwardRef<SheetRef, Props>(
  function DeleteAccountFeedbackSheet({ isSubmitting, onSubmit }, parentRef) {
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

    const [selected, setSelected] = useState<Set<Reason>>(new Set());
    const [otherText, setOtherText] = useState('');

    const toggle = (reason: Reason) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(reason)) next.delete(reason);
        else next.add(reason);
        return next;
      });
    };

    const otherSelected = selected.has('other');

    const buildFeedback = (): DeleteAccountFeedback | undefined => {
      const reasons = Array.from(selected);
      const trimmed = otherText.trim().slice(0, OTHER_TEXT_MAX);
      if (reasons.length === 0 && trimmed.length === 0) return undefined;
      return {
        reasons,
        ...(trimmed.length > 0 ? { otherText: trimmed } : {}),
      };
    };

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'stuck', detent: 'large' }}
        // A text input wants the content to shrink around the keyboard rather
        // than slide under it.
        androidKeyboardInputMode="adjustResize"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Sheet.ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Txt
              typography="t2"
              fontWeight="bold"
              color={SdsColors.grey900}
              style={styles.title}
            >
              {t('auth.deleteAccountFeedbackTitle')}
            </Txt>
            <Txt
              typography="t6"
              color={SdsColors.grey500}
              style={styles.subtitle}
            >
              {t('auth.deleteAccountFeedbackSubtitle')}
            </Txt>

            <View style={styles.list}>
              {REASONS.map((reason) => (
                <Checkbox.Line
                  key={reason}
                  checked={selected.has(reason)}
                  onCheckedChange={() => toggle(reason)}
                  style={styles.row}
                >
                  <Txt typography="t5" color={SdsColors.grey900}>
                    {t(`auth.deleteAccountReason.${reason}` as never) as string}
                  </Txt>
                </Checkbox.Line>
              ))}
            </View>

            {otherSelected && (
              <View style={styles.otherInputWrap}>
                <TextField
                  variant="box"
                  label={t('auth.deleteAccountReason.otherPlaceholder')}
                  value={otherText}
                  onChangeText={(text) =>
                    setOtherText(text.slice(0, OTHER_TEXT_MAX))
                  }
                  multiline
                  maxLength={OTHER_TEXT_MAX}
                />
              </View>
            )}

            <View style={styles.actions}>
              <Button
                type="dark"
                style="weak"
                size="medium"
                display="block"
                disabled={isSubmitting}
                onPress={() => onSubmit(undefined)}
              >
                {t('auth.deleteAccountSkip')}
              </Button>
              <View style={{ height: 8 }} />
              <Button
                type="danger"
                size="medium"
                display="block"
                disabled={isSubmitting}
                onPress={() => onSubmit(buildFeedback())}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  t('auth.deleteAccountAction')
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
    marginBottom: SdsSpacing.sm,
  },
  subtitle: {
    marginBottom: SdsSpacing.xl,
  },
  list: {
    gap: SdsSpacing.sm,
  },
  row: {
    paddingVertical: 4,
  },
  otherInputWrap: {
    marginTop: SdsSpacing.md,
  },
  actions: {
    marginTop: SdsSpacing.xl,
  },
});
