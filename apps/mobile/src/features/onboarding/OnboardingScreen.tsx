import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  useNoticeTabs,
  useNotificationStore,
  useSettingsStore,
  useT,
  type Campus,
  type TabSource,
} from '@skkuverse/shared';
import { GoogleAuthError } from '@/services/google-auth';
import { authStore } from '@skkuverse/shared';
import { signInWithDeviceMigration } from '@/services/auth-flow';
import { GoogleIcon } from '@/components/GoogleIcon';
import {
  finalizeOnboardingAccepted,
  seedOnboardingPreferences,
} from '@/services/firestore-notifications';
import { checkPermission } from '@/services/messaging';
import {
  registerCurrentDeviceForNotifications,
  useEnableNotificationsFlow,
} from '@/features/notifications/hooks/useEnableNotificationsFlow';
import { logHandledError } from '@/services/crashlytics';
import {
  logOnboardingStep,
  logScreenView,
  type OnboardingStepKey,
} from '@/services/analytics';
import type { OnboardingAction, OnboardingState, OnboardingStep } from './types';
import { MAX_INTEREST_DEPTS } from './types';
import { UNSUPPORTED_DEPT_SURVEY_URL } from './constants';
import { OnboardingLayout } from './components/OnboardingLayout';
import { CampusStep } from './components/CampusStep';
import { PrimaryDeptStep } from './components/PrimaryDeptStep';
import { InterestDeptStep } from './components/InterestDeptStep';
import { LoginStep } from './components/LoginStep';
import { NotificationStep } from './components/NotificationStep';
import { NoticeCategoriesStep } from './components/NoticeCategoriesStep';
import { CompletionStep } from './components/CompletionStep';
import { ExitDialog } from './components/ExitDialog';
import { assembleOnboardingPickerSelections } from './utils/assemblePickerSelections';

const STEP_KEYS: Record<number, OnboardingStepKey> = {
  1: 'campus',
  2: 'primary_dept',
  3: 'interest_dept',
  4: 'login',
  5: 'notification',
  6: 'notice_categories',
  7: 'completion',
};

// ── Reducer ──

const initialState: OnboardingState = {
  step: 1,
  campus: null,
  primaryDeptId: null,
  interestDeptIds: [],
  userName: null,
  notificationsAccepted: null,
  seededPickerSelections: null,
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
        // Invalidate cached picker (J1) — user edited dept after ACCEPT, finalize
        // must reassemble from fresh state to avoid Firestore↔local drift.
        seededPickerSelections: null,
      };

    case 'SKIP_PRIMARY_DEPT':
      // User tapped "내 학과가 없어요" → opened survey webview → dismissed.
      // primary null로 마킹. interest는 보존 (이후 step에서 picking 가능).
      return { ...state, primaryDeptId: null, seededPickerSelections: null };

    case 'TOGGLE_INTEREST_DEPT': {
      const exists = state.interestDeptIds.includes(action.deptId);
      if (exists) {
        return {
          ...state,
          interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
          seededPickerSelections: null,
        };
      }
      if (state.interestDeptIds.length >= MAX_INTEREST_DEPTS) return state;
      return {
        ...state,
        interestDeptIds: [...state.interestDeptIds, action.deptId],
        seededPickerSelections: null,
      };
    }

    case 'CLEAR_INTEREST_DEPTS':
      return { ...state, interestDeptIds: [], seededPickerSelections: null };

    case 'SET_USER':
      return { ...state, userName: action.name };

    case 'ACCEPT_NOTIFICATIONS':
      return {
        ...state,
        notificationsAccepted: true,
        seededPickerSelections: action.pickerSelections,
      };

    case 'DECLINE_NOTIFICATIONS':
      return { ...state, notificationsAccepted: false };

    case 'NEXT':
      if (state.step >= 7) return state;
      return { ...state, step: (state.step + 1) as OnboardingStep };

    case 'PREV':
      if (state.step <= 1) return state;
      // Declined 경로는 step 7에서 PREV 시 step 6를 스킵하고 step 5로 점프.
      // 카테고리 페이지(step 6)는 ACCEPT 경로에서만 의미가 있고, declined 상태로
      // 진입하면 seed가 안 됐으므로 토글이 silent fail.
      if (state.step === 7 && state.notificationsAccepted === false) {
        return { ...state, step: 5 };
      }
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

  // Per-step funnel: each step enter fires both screen_view + onboarding_step
  // event. Reducer-driven so it auto-fires on advance/back/skip.
  useEffect(() => {
    const key = STEP_KEYS[state.step];
    if (key) {
      logScreenView(`onboarding_${key}`);
      logOnboardingStep({ step: key, action: 'enter' });
    }
  }, [state.step]);

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
  // step 7 (completion)에서만 back 차단. step 6 (카테고리)는 정상 PREV 허용.
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.step === 7) return true; // Block back on completion
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
    const key = STEP_KEYS[state.step];
    if (state.step === 1) {
      if (key) logOnboardingStep({ step: key, action: 'exit_cancel' });
      setShowExitDialog(true);
    } else {
      if (key) logOnboardingStep({ step: key, action: 'back' });
      dispatch({ type: 'PREV' });
    }
  }, [state.step]);

  const handleLeave = useCallback(() => {
    const key = STEP_KEYS[state.step];
    if (key) logOnboardingStep({ step: key, action: 'exit_leave' });
    setShowExitDialog(false);
    router.back();
  }, [router, state.step]);

  // ── Google Sign-In (Step 4) ──
  // Wizard 강제 흐름 — classifyAndRestoreOnboarding은 의도적으로 호출하지 않음.
  // 신규 가입자는 step 5에서 권한 선택, step 7에서 seedOnboardingPreferences로
  // 새 시드를 쓰고, 이미 onboarded된 사용자가 wizard로 들어와도 동일하게 시드를
  // 덮어쓴다 (의도적). 자동복원이 필요한 returning user는 다른 진입점
  // (notices landing의 "이미 가입한 적 있어요" 또는 login.tsx)을 사용.
  //
  // 2026-05-25: step 5 auto-skip 제거. 권한 상태와 무관하게 항상 "받을까요?"
  // 페이지를 노출하여 명시적 선택을 유도. checkPermission 호출도 불필요.
  const handleSignIn = useCallback(async () => {
    setLoginLoading(true);
    setLoginError(null);
    logOnboardingStep({ step: 'login', action: 'signin_attempt' });
    try {
      const user = await signInWithDeviceMigration('onboarding');
      logOnboardingStep({ step: 'login', action: 'signin_success' });
      dispatch({ type: 'SET_USER', name: user.displayName ?? '' });
      dispatch({ type: 'NEXT' });
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            logOnboardingStep({ step: 'login', action: 'signin_error', detail: 'domain_not_allowed' });
            setLoginError(t('onboarding.oauthErrorTitle'));
            break;
          case 'CANCELLED':
            logOnboardingStep({ step: 'login', action: 'signin_error', detail: 'cancelled' });
            break;
          default:
            logOnboardingStep({ step: 'login', action: 'signin_error', detail: err.code });
            setLoginError(t('onboarding.oauthErrorRetry'));
        }
      } else {
        logOnboardingStep({ step: 'login', action: 'signin_error', detail: 'unknown' });
        setLoginError(t('onboarding.oauthErrorRetry'));
      }
    } finally {
      setLoginLoading(false);
    }
  }, [t]);

  // ── ACCEPT 경로 — Step 6 카테고리 페이지 진입 준비 ──
  // doc seed (onboardedAt:null) → setNoticeTabEnabled가 dot-path update로 동작
  // 가능한 상태로 만들어두고 step 6 진입.
  //
  // 핵심 규칙: seed 성공한 경우에만 advance. seed 실패 시 step 5 유지 + alert
  // 표시하여 사용자가 retry 할 수 있게 함. 옛 버전은 catch 후에도 NEXT 했지만
  // 그 경로는 step 6 토글 silent fail + step 7 finalize NOT_FOUND → 영구
  // broken state 였음 (code-review A1). 또한 inFlightRef 가드로 double-tap
  // 시 두 번째 NEXT 가 step 6를 건너뛰는 race 차단 (G1).
  const prepareCategoryStepInFlight = useRef(false);
  const prepareCategoryStep = useCallback(async () => {
    if (prepareCategoryStepInFlight.current) return;
    prepareCategoryStepInFlight.current = true;
    try {
      const uid = authStore.getState().uid;
      if (!uid || !state.campus || !tabsConfig) return;
      const picker = assembleOnboardingPickerSelections({
        campus: state.campus,
        primaryDeptId: state.primaryDeptId,
        interestDeptIds: state.interestDeptIds,
        tabsConfig,
      });
      try {
        await seedOnboardingPreferences(uid, picker, {
          enabled: true,
          finalize: false,
        });
      } catch (err) {
        logHandledError('onboarding/seed-intent', err);
        Alert.alert(t('onboarding.seedErrorTitle'), t('onboarding.seedErrorMessage'));
        return; // 핵심: NEXT 안 함 — 사용자가 step 5에서 retry 가능
      }
      dispatch({ type: 'ACCEPT_NOTIFICATIONS', pickerSelections: picker });
      dispatch({ type: 'NEXT' }); // 5 → 6
    } finally {
      prepareCategoryStepInFlight.current = false;
    }
  }, [state.campus, state.primaryDeptId, state.interestDeptIds, tabsConfig, t]);

  // ── Notification permission (Step 5) ──
  // handleEnable 내부의 3분기 (denied → openOsSettings, notDetermined →
  // requestPermission, authorized → idempotent) 는 hook이 캡슐화.
  // onResolved({granted}) 결과로 ACCEPT/DECLINE 분기:
  //   - granted true  → prepareCategoryStep (seed + step 6 진입)
  //   - granted false → DECLINE + step 7로 점프 (step 6 스킵)
  // System dialog 거절한 경우도 granted=false라 DECLINE 분기와 통합.
  const { handleEnable } = useEnableNotificationsFlow({
    onResolved: ({ granted }) => {
      logOnboardingStep({
        step: 'notification',
        action: granted ? 'permission_grant' : 'permission_deny',
      });
      if (granted) {
        void prepareCategoryStep();
      } else {
        dispatch({ type: 'DECLINE_NOTIFICATIONS' });
        dispatch({ type: 'NEXT' });
        dispatch({ type: 'NEXT' }); // 5 → 7
      }
    },
  });

  // ── "안 받을게요" (Step 5 보조 액션) ──
  // OS 권한이 이미 granted면 토큰은 등록 (master OFF라 실제 전송은 안 됨,
  // 추후 master ON 전환 시 cold start 없이 즉시 전송 가능).
  //
  // 권한 status는 OS truth로 fresh fetch (cached값은 stale 가능 — C1 fix).
  // useAppInit의 refresh path는 onboardingCompleted gate 때문에 wizard 중엔
  // 안 돌아서, MMKV cache가 'denied' 인 채로 사용자가 OS 설정에서 외부로
  // granted한 경우 cache를 못 따라가 토큰 미등록 회귀가 있었음.
  // checkPermission은 OS dialog 없는 read-only query라 declined intent를 침해 안 함.
  const handleSkipNotifications = useCallback(async () => {
    logOnboardingStep({ step: 'notification', action: 'skip' });
    try {
      const status = await checkPermission();
      useNotificationStore.getState().setPermissionStatus(status);
      if (status === 'authorized' || status === 'provisional') {
        void registerCurrentDeviceForNotifications().catch((err) =>
          logHandledError('onboarding/register-decline-path', err),
        );
      }
    } catch (err) {
      // checkPermission 실패는 non-fatal — 토큰 등록만 건너뜀.
      logHandledError('onboarding/skip-check-permission', err);
    }
    dispatch({ type: 'DECLINE_NOTIFICATIONS' });
    dispatch({ type: 'NEXT' });
    dispatch({ type: 'NEXT' }); // 5 → 7
  }, []);

  // ── Completion (Step 7) ──
  // 분기:
  //   - ACCEPT: prepareCategoryStep에서 doc seed됨 → finalizeOnboardingAccepted
  //     (onboardedAt null→timestamp 단일 update).
  //   - DECLINE: doc 미존재 가능 → seedOnboardingPreferences가 doc 존재 분기로
  //     처리 (없으면 .set(), 있으면 dot-path update). enabled:false +
  //     categoryEnabled.notices:false 명시 — master OFF intent를 SSOT에 기록.
  // zustand `completeOnboarding`은 양쪽 모두 호출 — 로컬 게이트 해제.
  const handleComplete = useCallback(async () => {
    if (!state.campus) return;
    logOnboardingStep({ step: 'completion', action: 'complete' });
    const campus: Campus = state.campus;
    useSettingsStore.getState().completeOnboarding({
      campus,
      primaryDeptId: state.primaryDeptId,
      interestDeptIds: state.interestDeptIds,
    });

    const uid = authStore.getState().uid;
    if (uid) {
      try {
        if (state.notificationsAccepted === true) {
          await finalizeOnboardingAccepted(uid);
        } else {
          const picker =
            state.seededPickerSelections ??
            assembleOnboardingPickerSelections({
              campus,
              primaryDeptId: state.primaryDeptId,
              interestDeptIds: state.interestDeptIds,
              tabsConfig,
            });
          await seedOnboardingPreferences(uid, picker, {
            enabled: false,
            finalize: true,
          });
        }
      } catch (err) {
        // Non-fatal: 사용자는 설정 화면에서 재토글 가능.
        logHandledError('onboarding/finalize', err);
      }
    }

    router.dismissAll();
  }, [
    state.campus,
    state.primaryDeptId,
    state.interestDeptIds,
    state.notificationsAccepted,
    state.seededPickerSelections,
    router,
    tabsConfig,
  ]);

  // ── Next step ──
  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  // ── Skip interests (Step 3) ──
  const handleSkipInterests = useCallback(() => {
    logOnboardingStep({ step: 'interest_dept', action: 'clear_interest_depts' });
    dispatch({ type: 'CLEAR_INTEREST_DEPTS' });
    dispatch({ type: 'NEXT' });
  }, []);

  // ── Skip primary dept (Step 2 "내 학과가 없어요") ──
  // Opens in-app webview with the "request my dept" survey/info page.
  // Result type (cancel/dismiss) is intentionally ignored — closing the
  // browser is itself the decision to skip and advance.
  const handleUnsupportedDept = useCallback(async () => {
    logOnboardingStep({ step: 'primary_dept', action: 'go_dept_survey' });
    await WebBrowser.openBrowserAsync(UNSUPPORTED_DEPT_SURVEY_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: '#1A8A5C',
      toolbarColor: '#ffffff',
      dismissButtonStyle: 'close',
      showTitle: true,
      enableBarCollapsing: true,
    });
    dispatch({ type: 'SKIP_PRIMARY_DEPT' });
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
      case 5: return t('onboarding.notificationCta');
      case 7: return t('onboarding.completionCta');
      default: return t('onboarding.next');
    }
  })();

  const onCtaPress = (() => {
    switch (state.step) {
      case 4: return handleSignIn;
      case 5: return handleEnable;
      case 7: return handleComplete;
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
            primaryDeptId={state.primaryDeptId}
            sources={deptList}
            selectedIds={state.interestDeptIds}
            onToggle={(deptId: string) => dispatch({ type: 'TOGGLE_INTEREST_DEPT', deptId })}
          />
        );
      case 4:
        return (
          <LoginStep
            campus={state.campus!}
            primaryDeptId={state.primaryDeptId}
            interestDeptIds={state.interestDeptIds}
            sources={deptList}
            loginError={loginError}
          />
        );
      case 5:
        return <NotificationStep />;
      case 6:
        return <NoticeCategoriesStep />;
      case 7:
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
        minimal={state.step === 7}
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
          state.step === 2
            ? { label: t('onboarding.primaryDeptUnsupportedHelp'), onPress: handleUnsupportedDept }
            : state.step === 3
            ? { label: t('onboarding.skip'), onPress: handleSkipInterests }
            : state.step === 5
            ? { label: t('onboarding.notificationSkip'), onPress: handleSkipNotifications }
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
