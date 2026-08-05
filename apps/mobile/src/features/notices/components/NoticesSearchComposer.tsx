/**
 * Bottom composer — the search screen's only input.
 *
 * ── Why the input moved from the header to the bottom ──
 *
 * The screen used to be a search field pinned under a back button, with
 * results filling everything below. That layout says "type keywords, scan a
 * list". This one says "ask a question": the field sits where your thumb
 * already is, above the keyboard, with the scope selector and send button on
 * its own row — the shape people now read as a conversation input.
 *
 * The scope chip occupies the slot a chat app gives its model picker, which is
 * the right analogy: it is the one setting that changes how the answer is
 * produced, and it belongs next to the thing you are about to send.
 *
 * Keyboard tracking uses Reanimated's `useAnimatedKeyboard` rather than
 * `KeyboardAvoidingView`. The RN component recomputes layout from JS on every
 * keyboard frame and visibly lags the system animation on iOS; the shared
 * value here is driven on the UI thread and stays locked to the keyboard.
 * (This animates `marginBottom` rather than a transform — the one place the
 * transform-only rule is traded away, because a translate would leave the
 * body's flex height wrong and the results would scroll under the composer.)
 */

import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpIcon, CaretDownIcon } from 'phosphor-react-native';
import { SdsColors, SdsRadius, SdsSpacing, useT } from '@skkuverse/shared';
import { Txt, colorSeeds } from '@skkuverse/sds';
import { PressableScale } from '@/components/motion';

interface Props extends Pick<TextInputProps, 'value' | 'onChangeText'> {
  placeholder: string;
  /** Resolved scope label — a tab name, or 전체. */
  scopeLabel: string;
  onScopePress: () => void;
  onSubmit: () => void;
  /** False while the query is too short to be worth sending. */
  canSubmit: boolean;
}

export const NoticesSearchComposer = forwardRef<TextInput, Props>(
  function NoticesSearchComposer(
    { value, onChangeText, placeholder, scopeLabel, onScopePress, onSubmit, canSubmit },
    ref,
  ) {
    const { t } = useT();
    const insets = useSafeAreaInsets();
    const keyboard = useAnimatedKeyboard();

    const lift = useAnimatedStyle(() => ({
      // Below the keyboard's own height sits the home indicator inset, which
      // the keyboard already covers — subtract it so the composer doesn't
      // float with a gap while the keyboard is up.
      marginBottom: Math.max(keyboard.height.value - insets.bottom, 0),
    }));

    return (
      <Animated.View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }, lift]}>
        <View style={styles.box}>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={SdsColors.grey400}
            style={styles.input}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={onSubmit}
          />

          <View style={styles.row}>
            <PressableScale
              onPress={onScopePress}
              style={styles.scopeChip}
              accessibilityRole="button"
              accessibilityLabel={scopeLabel}
            >
              <Txt typography="t7" fontWeight="semibold" color={SdsColors.grey700}>
                {scopeLabel}
              </Txt>
              <CaretDownIcon size={11} weight="bold" color={SdsColors.grey500} />
            </PressableScale>

            <PressableScale
              onPress={onSubmit}
              disabled={!canSubmit}
              style={[styles.send, !canSubmit && styles.sendDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('notices.search.submit')}
            >
              <ArrowUpIcon
                size={17}
                weight="bold"
                color={canSubmit ? SdsColors.background : SdsColors.grey400}
              />
            </PressableScale>
          </View>
        </View>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SdsSpacing.md,
    paddingTop: SdsSpacing.sm,
  },
  box: {
    borderRadius: 22,
    backgroundColor: SdsColors.grey50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SdsColors.grey200,
    paddingHorizontal: SdsSpacing.base,
    paddingTop: 14,
    paddingBottom: SdsSpacing.sm,
    gap: SdsSpacing.sm,
  },
  input: {
    fontFamily: 'WantedSans',
    fontSize: 16,
    lineHeight: 22,
    color: SdsColors.grey900,
    // Two lines before it scrolls — long questions stay readable without the
    // composer swallowing the screen.
    maxHeight: 96,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey100,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorSeeds.primary,
  },
  sendDisabled: {
    backgroundColor: SdsColors.grey200,
  },
});
