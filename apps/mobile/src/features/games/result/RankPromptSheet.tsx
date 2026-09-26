import { StyleSheet, View } from 'react-native';
import { Button, Sheet, TextButton, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import { GoogleIcon } from '@/components/GoogleIcon';

interface Props {
  open: boolean;
  /** What stands between this run and the board. */
  variant: 'signIn' | 'setup';
  /** This run's score as a sentence says it, with its unit ("1,234점", "1:02.34"). */
  score: string;
  /** The Google sheet is up. */
  busy: boolean;
  error: string | null;
  onAccept(): void;
  /** "Later", a swipe-down or a backdrop tap: the player moves on without it. */
  onLater(): void;
}

/**
 * Asked once, after "next", when a run could go on the board but the player
 * cannot be put there yet — no Google account, or no nickname. The result
 * screen never nags; this is the one moment the offer is made, and declining
 * simply carries on.
 */
export function RankPromptSheet({ open, variant, score, busy, error, onAccept, onLater }: Props) {
  const { t, tpl } = useT();
  const signIn = variant === 'signIn';
  return (
    // Glass floats over the game on iOS 26+; SDS falls back to the solid sheet elsewhere.
    <Sheet open={open} position={{ kind: 'fit' }} surface="glass" backdrop onDismiss={onLater}>
      <Sheet.View style={styles.content}>
        <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
          {t(signIn ? 'game.rankPrompt.signInTitle' : 'game.rankPrompt.nicknameTitle')}
        </Txt>
        <Txt typography="t6" color={SdsColors.grey600} style={styles.body}>
          {signIn ? t('game.rankPrompt.signInBody') : tpl('game.rankPrompt.body', score)}
        </Txt>
        {error && (
          <Txt typography="t7" color={SdsColors.red500} style={styles.error}>
            {error}
          </Txt>
        )}
        <View style={styles.actions}>
          {/* The same buttons, words and colours as every other sign-in and skip in the app. */}
          <Button
            type={signIn ? 'dark' : 'primary'}
            size="big"
            display="block"
            loading={busy}
            leftAccessory={signIn ? <GoogleIcon size={20} /> : undefined}
            onPress={onAccept}
          >
            {t(signIn ? 'auth.googleSignIn' : 'game.rankPrompt.nicknameCta')}
          </Button>
          <TextButton
            typography="t6"
            color={SdsColors.grey400}
            fontWeight="medium"
            disabled={busy}
            onPress={onLater}
            style={styles.later}
          >
            {t('intro.loginSkip')}
          </TextButton>
        </View>
      </Sheet.View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.xl,
    paddingTop: SdsSpacing.lg,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: { marginBottom: 8 },
  body: { marginBottom: SdsSpacing.xl },
  error: { marginTop: -12, marginBottom: 16 },
  actions: { gap: 4 },
  later: { alignSelf: 'center', paddingVertical: 12 },
});
