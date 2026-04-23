import { useCallback, useEffect, useReducer, useState } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@skkuverse/sds';
import { useSettingsStore, useT, type Campus } from '@skkuverse/shared';
import { signInWithGoogle, GoogleAuthError } from '@/services/google-auth';
import { authStore } from '@skkuverse/shared';
import { GoogleIcon } from '@/components/GoogleIcon';

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

  const handleClose = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  const handleLeave = useCallback(() => {
    setShowExitDialog(false);
    router.back();
  }, [router]);

  // ── Google Sign-In (Step 4) ──
  const handleSignIn = useCallback(async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      authStore.getState().setAuthenticated({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        isAnonymous: user.isAnonymous,
      });
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
  const handleComplete = useCallback(() => {
    if (!state.campus || !state.primaryDeptId) return;
    const store = useSettingsStore.getState();
    store.completeOnboarding({
      campus: state.campus,
      primaryDeptId: state.primaryDeptId,
      interestDeptIds: state.interestDeptIds,
    });
    // Seed the dept picker from the onboarding choices so notices tab and
    // notification settings both show them immediately (instead of silently
    // falling back to server defaults). Primary first, then interests; dedup.
    // Truncate to the server `dept` picker's maxSelection (3 — see
    // skkuverse-server/features/notices/categories.json).
    const combined: string[] = [];
    const seen = new Set<string>();
    for (const id of [state.primaryDeptId, ...state.interestDeptIds]) {
      if (!seen.has(id)) {
        seen.add(id);
        combined.push(id);
      }
    }
    const DEPT_PICKER_MAX = 3;
    store.setPickerSelection('dept', combined.slice(0, DEPT_PICKER_MAX));
    router.dismissAll();
  }, [state.campus, state.primaryDeptId, state.interestDeptIds, router]);

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
            selectedId={state.primaryDeptId}
            onSelect={(deptId: string) => dispatch({ type: 'SET_PRIMARY_DEPT', deptId })}
          />
        );
      case 3:
        return (
          <InterestDeptStep
            campus={state.campus!}
            primaryDeptId={state.primaryDeptId!}
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
        step={state.step}
        onBack={handleBack}
        onClose={handleClose}
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
        ctaFineprint={state.step === 4 ? t('onboarding.loginFineprint') : undefined}
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
