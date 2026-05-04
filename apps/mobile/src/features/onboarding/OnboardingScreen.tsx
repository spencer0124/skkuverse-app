import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  computeOnboardingPickerSeed,
  useNoticeTabs,
  useSettingsStore,
  useT,
  type Campus,
  type TabSource,
} from '@skkuverse/shared';
import { GoogleAuthError } from '@/services/google-auth';
import { authStore } from '@skkuverse/shared';
import { signInWithDeviceMigration } from '@/services/auth-flow';
import { GoogleIcon } from '@/components/GoogleIcon';
import { seedOnboardingPreferences } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';

import type { OnboardingAction, OnboardingState, OnboardingStep } from './types';
import { MAX_INTEREST_DEPTS } from './types';
import { OnboardingLayout } from './components/OnboardingLayout';
import { CampusStep } from './components/CampusStep';
import { PrimaryDeptStep } from './components/PrimaryDeptStep';
import { InterestDeptStep } from './components/InterestDeptStep';
import { LoginStep } from './components/LoginStep';
import { CompletionStep } from './components/CompletionStep';
import { ExitDialog } from './components/ExitDialog';

// ── Reducer ──

const initialState: OnboardingState = {
  step: 1,
  campus: null,
  primaryDeptId: null,
  interestDeptIds: [],
  userName: null,
};

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_CAMPUS':
      return { ...state, campus: action.campus };

    case 'SET_PRIMARY_DEPT':
      return {
        ...state,
        primaryDeptId: action.deptId,
        // Remove new primary from interest list if present
        interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
      };

    case 'TOGGLE_INTEREST_DEPT': {
      const exists = state.interestDeptIds.includes(action.deptId);
      if (exists) {
        return {
          ...state,
          interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
        };
      }
      if (state.interestDeptIds.length >= MAX_INTEREST_DEPTS) return state;
      return {
        ...state,
        interestDeptIds: [...state.interestDeptIds, action.deptId],
      };
    }

    case 'CLEAR_INTEREST_DEPTS':
      return { ...state, interestDeptIds: [] };

    case 'SET_USER':
      return { ...state, userName: action.name };

    case 'NEXT':
      if (state.step >= 5) return state;
      return { ...state, step: (state.step + 1) as OnboardingStep };

    case 'PREV':
      if (state.step <= 1) return state;
      return { ...state, step: (state.step - 1) as OnboardingStep };

    default:
      return state;
  }
}

// ── Screen ──

export function OnboardingScreen() {
  const router = useRouter();
  const { t } = useT();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Server-driven dept list. Fetched once; dept picker lists are embedded in
  // /notices/tabs so we reuse the same hook the notices tab + settings use.
  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();
  const deptList: TabSource[] = useMemo(() => {
    const deptTab = tabsConfig?.tabs.find((t) => t.key === 'dept');
    return deptTab?.picker?.sources ?? [];
  }, [tabsConfig]);

  // ── Android back handler ──
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.step === 5) return true; // Block back on completion
      if (state.step === 1) {
        setShowExitDialog(true);
        return true;
      }
      dispatch({ type: 'PREV' });
      return true;
    });
    return () => handler.remove();
  }, [state.step]);

  // ── Navigation helpers ──
  const handleBack = useCallback(() => {
    if (state.step === 1) {
      setShowExitDialog(true);
    } else {
      dispatch({ type: 'PREV' });
    }
  }, [state.step]);

  const handleLeave = useCallback(() => {
    setShowExitDialog(false);
    router.back();
  }, [router]);

  // ── Google Sign-In (Step 4) ──
  // Wizard 강제 흐름 — classifyAndRestoreOnboarding은 의도적으로 호출하지 않음.
  // 신규 가입자는 step 5에서 seedOnboardingPreferences로 새 시드를 쓰고,
  // 이미 onboarded된 사용자가 wizard로 들어와도 step 5 완료 시 동일하게
  // 시드를 덮어쓴다 (의도적 — wizard 진입 자체가 사용자가 다시 wizard
  // 통과하기로 한 결정). 자동복원이 필요한 returning user는 다른 진입점
  // (notices landing의 "이미 가입한 적 있어요" 또는 login.tsx)을 사용.
  const handleSignIn = useCallback(async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const user = await signInWithDeviceMigration('onboarding');
      dispatch({ type: 'SET_USER', name: user.displayName ?? '' });
      dispatch({ type: 'NEXT' });
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            setLoginError(t('onboarding.oauthErrorTitle'));
            break;
          case 'CANCELLED':
            break;
          default:
            setLoginError(t('onboarding.oauthErrorRetry'));
        }
      } else {
        setLoginError(t('onboarding.oauthErrorRetry'));
      }
    } finally {
      setLoginLoading(false);
    }
  }, [t]);

  // ── Completion (Step 5) ──
  // Seeds Firestore preferences/main with intent: master ON, notices ON.
  // pickerSelections per tab:
  //   - dept: user picks (primary + interests, deduped, capped by server's
  //     dept.picker.maxSelection — no client magic number).
  //   - library / dorm: common defaults + campus-specific defaults derived
  //     from the server's defaultIds + campusDefaultIds (computed via
  //     computeOnboardingPickerSeed). User can uncheck in Settings later
  //     (soft default — no UI lock).
  //   - general (and any other picker tab without defaults): key omitted →
  //     derive() emits 0 topics rather than an explicit empty-list intent.
  // The CF onPreferencesWrite trigger derives subscribedTopics within ~1-3s.
  // zustand `completeOnboarding` continues to track the local "did this user
  // finish onboarding?" flag.
  const handleComplete = useCallback(async () => {
    if (!state.campus || !state.primaryDeptId) return;
    const campus: Campus = state.campus;
    const settingsStore = useSettingsStore.getState();
    settingsStore.completeOnboarding({
      campus,
      primaryDeptId: state.primaryDeptId,
      interestDeptIds: state.interestDeptIds,
    });

    const uid = authStore.getState().uid;
    if (uid) {
      // dept: user picks (deduped + capped)
      const combined: string[] = [];
      const seen = new Set<string>();
      for (const id of [state.primaryDeptId, ...state.interestDeptIds]) {
        if (!seen.has(id)) {
          seen.add(id);
          combined.push(id);
        }
      }
      const deptTab = tabsConfig?.tabs.find((tab) => tab.key === 'dept');
      const maxPicks = deptTab?.picker?.maxSelection ?? combined.length;
      const seedDeptIds = combined.slice(0, maxPicks);

      const pickerSelections: Record<string, string[]> = { dept: seedDeptIds };

      // library / dorm get campus-aware seeds. Other picker tabs (general)
      // currently have no defaults configured server-side — omit so the CF
      // derive trigger emits 0 topics for them rather than persisting an
      // explicit empty-list intent that would later look like "user opted
      // out" in the settings UI.
      for (const seedKey of ['library', 'dorm']) {
        const tab = tabsConfig?.tabs.find((t) => t.key === seedKey);
        if (tab) {
          const seed = computeOnboardingPickerSeed(tab, campus);
          if (seed.length > 0) {
            pickerSelections[seedKey] = seed;
          }
        }
      }

      try {
        await seedOnboardingPreferences(uid, pickerSelections);
      } catch (err) {
        // Non-fatal: user can re-toggle in Settings if the write fails.
        logHandledError('onboarding/seed-prefs', err);
      }
    }

    router.dismissAll();
  }, [state.campus, state.primaryDeptId, state.interestDeptIds, router, tabsConfig]);

  // ── Next step ──
  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  // ── Skip interests (Step 3) ──
  const handleSkipInterests = useCallback(() => {
    dispatch({ type: 'CLEAR_INTEREST_DEPTS' });
    dispatch({ type: 'NEXT' });
  }, []);

  // ── CTA config per step ──
  const ctaDisabled = (() => {
    switch (state.step) {
      case 1: return state.campus === null;
      case 2: return state.primaryDeptId === null;
      case 3: return state.interestDeptIds.length === 0;
      default: return false;
    }
  })();

  const ctaLabel = (() => {
    switch (state.step) {
      case 5: return t('onboarding.completionCta');
      default: return t('onboarding.next');
    }
  })();

  const onCtaPress = (() => {
    switch (state.step) {
      case 4: return handleSignIn;
      case 5: return handleComplete;
      default: return handleNext;
    }
  })();

  // ── Render step content ──
  const renderStep = () => {
    // Steps 2/3/4 depend on the server dept list. Show a loading / error
    // placeholder instead of a half-empty picker so the user doesn't
    // complete onboarding with an invalid (empty) selection set.
    const needsDeptData = state.step >= 2 && state.step <= 4;
    if (needsDeptData && tabsLoading && deptList.length === 0) {
      return (
        <View style={stepStyles.placeholder}>
          <ActivityIndicator size="large" color={SdsColors.grey500} />
        </View>
      );
    }
    if (needsDeptData && tabsError && deptList.length === 0) {
      return (
        <View style={stepStyles.placeholder}>
          <Txt typography="t6" color={SdsColors.grey600} style={stepStyles.errorText}>
            {t('notifications.loadError')}
          </Txt>
          <Button
            type="dark"
            style="weak"
            size="tiny"
            onPress={() => refetchTabs()}
          >
            {t('notifications.retry')}
          </Button>
        </View>
      );
    }

    switch (state.step) {
      case 1:
        return (
          <CampusStep
            selected={state.campus}
            onSelect={(campus: Campus) => dispatch({ type: 'SET_CAMPUS', campus })}
          />
        );
      case 2:
        return (
          <PrimaryDeptStep
            campus={state.campus!}
            sources={deptList}
            selectedId={state.primaryDeptId}
            onSelect={(deptId: string) => dispatch({ type: 'SET_PRIMARY_DEPT', deptId })}
          />
        );
      case 3:
        return (
          <InterestDeptStep
            campus={state.campus!}
            primaryDeptId={state.primaryDeptId!}
            sources={deptList}
            selectedIds={state.interestDeptIds}
            onToggle={(deptId: string) => dispatch({ type: 'TOGGLE_INTEREST_DEPT', deptId })}
          />
        );
      case 4:
        return (
          <LoginStep
            campus={state.campus!}
            primaryDeptId={state.primaryDeptId!}
            interestDeptIds={state.interestDeptIds}
            sources={deptList}
            loginError={loginError}
          />
        );
      case 5:
        return <CompletionStep userName={state.userName ?? ''} />;
    }
  };

  return (
    <>
      <OnboardingLayout
        onBack={handleBack}
        ctaLabel={ctaLabel}
        ctaDisabled={ctaDisabled}
        onCtaPress={onCtaPress}
        minimal={state.step === 5}
        ctaContent={
          state.step === 4
            ? (
                <Button
                  type="dark"
                  size="big"
                  display="block"
                  loading={loginLoading}
                  onPress={handleSignIn}
                  leftAccessory={<GoogleIcon size={20} />}
                >
                  {t('onboarding.loginCta')}
                </Button>
              )
            : undefined
        }
        secondaryAction={
          state.step === 3
            ? { label: t('onboarding.skip'), onPress: handleSkipInterests }
            : undefined
        }
      >
        {renderStep()}
      </OnboardingLayout>

      <ExitDialog
        open={showExitDialog}
        onContinue={() => setShowExitDialog(false)}
        onLeave={handleLeave}
      />
    </>
  );
}

const stepStyles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    textAlign: 'center',
  },
});
