import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FixedBottomCTA, TextButton, Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';

import {
  MapPreviewCard,
  NoticePreviewCard,
  ShuttlePreviewCard,
} from '@/components/previews';
import { GoogleIcon } from '@/components/GoogleIcon';
import {
  classifyAndRestoreOnboarding,
  signInWithDeviceMigration,
} from '@/services/auth-flow';
import { GoogleAuthError } from '@/services/google-auth';
import { logIntroStep, logScreenView, type IntroStepKey } from '@/services/analytics';
import { IntroDots } from './components/IntroDots';
import { IntroEmojiField } from './components/IntroEmojiField';
import { IntroPage } from './components/IntroPage';

// Page order, and the analytics key each index reports. The JSX below renders
// the same four in the same order — keep them in step.
const PAGE_KEYS: IntroStepKey[] = ['shuttle', 'map', 'notices', 'login'];

const LOGIN_INDEX = PAGE_KEYS.length - 1;

interface Props {
  /**
   * Leave the intro. The caller sets `introSeen`, so this is the ONLY exit —
   * hardware back walks pages instead of dismissing, or a user could back out
   * of page 1 and be toured again on the next launch.
   */
  onDone: () => void;
}

/**
 * First-launch value tour: 셔틀 → 캠퍼스맵 → AI공지 → Google 로그인.
 *
 * Shown once to every user who is not signed in with a Google account. Mounted
 * as a branch of InitGate rather than a route — see
 * docs/explanation/first-launch-intro.md for why.
 *
 * Sign-in is the last step. Unlike `app/login.tsx`, a successful sign-in routes
 * nowhere: the intro closes and the user lands in the app. The 7-step notices
 * wizard still runs later, behind the notices tab, minus its own login step.
 *
 * Paging is a plain `ScrollView pagingEnabled` — adding react-native-pager-view
 * would be a native dependency, and that costs a prebuild plus a runtimeVersion
 * bump for a horizontal snap the platform already does.
 */
export function IntroScreen({ onDone }: Props) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const pageKey = PAGE_KEYS[index] ?? PAGE_KEYS[0]!;

  // Per-page funnel, mirroring the wizard's pattern (OnboardingScreen.tsx:156).
  // Driven by `index` so it fires for a swipe and a CTA tap alike.
  useEffect(() => {
    const key = PAGE_KEYS[index];
    if (!key) return;
    logScreenView(`intro_${key}`);
    logIntroStep({ step: key, action: 'enter' });
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(PAGE_KEYS.length - 1, next));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
      setIndex(clamped);
    },
    [width],
  );

  // Android hardware back walks the tour backwards. On page 1 we return false so
  // the OS default (background the app) applies — deliberately NOT onDone(),
  // which would burn the one-shot `introSeen` flag on an accidental back press.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      goTo(index - 1);
      return true;
    });
    return () => sub.remove();
  }, [index, goTo]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const handleAdvance = useCallback(() => {
    logIntroStep({ step: pageKey, action: 'advance' });
    goTo(index + 1);
  }, [goTo, index, pageKey]);

  const handleSkip = useCallback(() => {
    logIntroStep({ step: 'login', action: 'skip' });
    onDone();
  }, [onDone]);

  const handleSignIn = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    logIntroStep({ step: 'login', action: 'signin_attempt' });
    try {
      const user = await signInWithDeviceMigration('intro');
      logIntroStep({ step: 'login', action: 'signin_success' });
      // Side effect only. A returning user's `onboardedAt` + dept mirror land in
      // MMKV here, so the notices tab opens straight into notices instead of
      // re-gating them. The `kind` is deliberately ignored for routing: sign-in
      // is the last step of the intro, and a new user meets the notices wizard
      // later, on their own terms.
      await classifyAndRestoreOnboarding(user.uid, 'intro');
      onDone();
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            logIntroStep({ step: 'login', action: 'signin_error', detail: 'domain_not_allowed' });
            setSignInError(t('auth.domainNotAllowed'));
            break;
          case 'CANCELLED':
            // Dismissing the Google sheet is not an error — stay put, say nothing.
            logIntroStep({ step: 'login', action: 'signin_error', detail: 'cancelled' });
            break;
          case 'PLAY_SERVICES_UNAVAILABLE':
            logIntroStep({ step: 'login', action: 'signin_error', detail: 'play_services' });
            setSignInError(t('auth.playServicesError'));
            break;
          default:
            logIntroStep({ step: 'login', action: 'signin_error', detail: err.code });
            setSignInError(t('auth.unknownError'));
        }
      } else {
        logIntroStep({ step: 'login', action: 'signin_error', detail: 'unknown' });
        setSignInError(t('auth.unknownError'));
      }
    } finally {
      setSigningIn(false);
    }
  }, [onDone, signingIn, t]);

  const onLoginPage = index === LOGIN_INDEX;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <IntroDots count={PAGE_KEYS.length} activeIndex={index} />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={!signingIn}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
      >
        <IntroPage
          width={width}
          title={t('intro.shuttleTitle')}
          body={t('intro.shuttleBody')}
          figure={<ShuttlePreviewCard />}
        />
        <IntroPage
          width={width}
          title={t('intro.mapTitle')}
          body={t('intro.mapBody')}
          figure={<MapPreviewCard />}
        />
        <IntroPage
          width={width}
          title={t('intro.noticesTitle')}
          body={t('intro.noticesBody')}
          figure={<NoticePreviewCard />}
        />
        <IntroPage
          width={width}
          title={t('intro.loginTitle')}
          body={t('intro.loginBody')}
          figure={<IntroEmojiField />}
        />
      </ScrollView>

      <FixedBottomCTA>
        {onLoginPage ? (
          <>
            <Button
              type="dark"
              size="big"
              display="block"
              loading={signingIn}
              onPress={handleSignIn}
              leftAccessory={<GoogleIcon size={20} />}
            >
              {t('intro.loginCta')}
            </Button>
            <TextButton
              typography="t6"
              color={SdsColors.grey400}
              fontWeight="medium"
              disabled={signingIn}
              onPress={handleSkip}
              style={styles.skipButton}
            >
              {t('intro.loginSkip')}
            </TextButton>
            {signInError ? (
              <Txt typography="t7" color={SdsColors.red500} style={styles.error}>
                {signInError}
              </Txt>
            ) : null}
          </>
        ) : (
          <Button type="primary" size="big" display="block" onPress={handleAdvance}>
            {t('intro.next')}
          </Button>
        )}
      </FixedBottomCTA>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  pager: {
    flex: 1,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 8,
  },
  error: {
    textAlign: 'center',
    marginTop: 8,
  },
});
