import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SdsColors, useAuthStore, useSettingsStore, useT } from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';
import { withRetry } from '@/utils/with-retry';
import { OnboardingLayout } from '@/features/onboarding/components/OnboardingLayout';
import { CampusStep } from '@/features/onboarding/components/CampusStep';
import { NicknameStep } from './components/NicknameStep';
import {
  answersOf,
  canAdvance,
  initialSetup,
  missingSteps,
  prefillFromDevice,
  setupReducer,
  type ProfileStep,
  type SetupAction,
  type UserProfile,
} from './domain';
import { getProfileFresh, saveProfile } from './repository';

interface Props {
  /** Ask for a nickname too (a leaderboard entry needs one). */
  requireNickname: boolean;
}

type Loaded = { profile: UserProfile | null; steps: ProfileStep[] };

const SAVE_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/**
 * Asks only what the profile is missing — the campus, and the nickname when
 * asked for — then saves and closes. The
 * caller watches the profile (useUserProfile) and carries on when it lands.
 */
export function ProfileSetupScreen({ requireNickname }: Props) {
  const router = useRouter();
  const uid = useAuthStore((s) => s.uid);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // What to ask is decided once, from the server's copy of the profile.
  useEffect(() => {
    if (!uid) {
      router.back();
      return;
    }
    let live = true;
    getProfileFresh(uid)
      .then((profile) => live && setLoaded({ profile, steps: missingSteps(profile, { requireNickname }) }))
      .catch((err) => {
        logHandledError('profile/setup-read', err);
        if (live) router.back();
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  if (!loaded || !uid) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={SdsColors.grey500} />
      </View>
    );
  }
  return <SetupFlow uid={uid} profile={loaded.profile} steps={loaded.steps} />;
}

function SetupFlow({ uid, profile, steps }: { uid: string; profile: UserProfile | null; steps: ProfileStep[] }) {
  const router = useRouter();
  const { t } = useT();
  const [s, dispatch] = useReducer(setupReducer, undefined, () =>
    initialSetup(steps, {
      nickname: profile?.nickname ?? null,
      prefill: prefillFromDevice(useSettingsStore.getState()),
    }),
  );
  const [saving, setSaving] = useState(false);
  // Guards every way out (CTA, skip, keyboard return, back) while a save is in
  // flight, so the screen closes exactly once.
  const busy = useRef(false);

  const isFirst = s.current === s.steps[0];
  const isLast = s.current === s.steps[s.steps.length - 1];

  const save = async (answers: Partial<UserProfile>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      // A write only resolves when the server answers; offline that is never,
      // and the screen must not wait on a spinner the player cannot leave.
      await withTimeout(withRetry(() => saveProfile(uid, answers)), SAVE_TIMEOUT_MS);
      router.back();
    } catch (err) {
      logHandledError('profile/save', err);
      Alert.alert(t('profile.saveError'));
      busy.current = false;
      setSaving(false);
    }
  };

  // Nothing to ask: close straight away.
  useEffect(() => {
    if (s.current === 'done') router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The move that would finish the flow saves instead of dispatching, so a
  // failed save leaves the player on the last question to try again.
  const advance = (action: SetupAction) => {
    if (busy.current) return;
    const nextState = setupReducer(s, action);
    if (nextState.current === 'done' && nextState !== s) void save(answersOf(nextState));
    else dispatch(action);
  };

  const back = useCallback(() => {
    if (busy.current) return true;
    if (isFirst) router.back();
    else dispatch({ type: 'PREV' });
    return true;
  }, [isFirst, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const next = () => advance({ type: 'NEXT' });

  const renderStep = () => {
    switch (s.current) {
      case 'campus':
        return (
          <CampusStep
            selected={s.campus}
            onSelect={(campus) => dispatch({ type: 'SET_CAMPUS', campus })}
            subtitle={t('profile.campusSubtitle')}
            track={false}
          />
        );
      case 'nickname':
        return (
          <NicknameStep
            value={s.nickname}
            onChange={(nickname) => dispatch({ type: 'SET_NICKNAME', nickname })}
            onSubmit={next}
          />
        );
      case 'done':
        return (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={SdsColors.grey500} />
          </View>
        );
    }
  };

  return (
    <OnboardingLayout
      onBack={back}
      ctaLabel={isLast ? t(s.steps.includes('nickname') ? 'profile.register' : 'profile.done') : t('onboarding.next')}
      ctaDisabled={!canAdvance(s) || saving}
      onCtaPress={next}
    >
      {renderStep()}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
