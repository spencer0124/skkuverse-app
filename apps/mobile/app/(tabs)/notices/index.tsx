import { useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import {
  authStore,
  useAuthStore,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { OnboardingLanding } from '@/features/notices/components/OnboardingLanding';
import { NoticesHeader } from '@/features/notices/components/NoticesHeader';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';
import { signInWithGoogle, GoogleAuthError } from '@/services/google-auth';
import {
  getPreferences,
  initializeFirestoreNotifications,
  unregisterDevice,
} from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';

// Custom header replaces native Stack header so the 9-tab fluid Tab control
// lives OUTSIDE the screen body view tree. The body itself is built to keep
// the SectionList as RNSScreen subviews[0] so iOS 26 NativeTabs
// `tabBarMinimizeBehavior` discovers it via the strict subviews[0] chain.
export default function NoticesTab() {
  useTabFocusTracking('notices');
  const router = useRouter();
  const { t } = useT();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // "이미 가입한 적 있어요" 단축경로 — Google 로그인 후 Firestore prefs SSOT
  // 에서 onboardedAt 시그널 + dept 미러를 즉시 가져와서 게이트 해제. listener
  // (useAppInit.ts:240) fallback도 같은 일을 하지만, sign-in 직후 명시 호출
  // 이 flicker window 차단 + 신규 vs 기존 가입자 분기 결정 시점 보장.
  //
  // device migration 순서(pre-unregister → sign-in → re-register)는 Task #12
  // 패턴 그대로 — login.tsx:33-79 미러. 핸들러 통합은 후속 PR.
  //
  // 'dept' 키 cross-link: 이 핸들러가 prefs.pickerSelections.dept를 직접
  // read하여 MMKV에 미러. 같은 read는 useAppInit.ts listener에도 존재.
  // server-side functions/src/notifications/tabsContract.ts에도 'dept' picker
  // tab key가 hardcoded — 셋 다 함께 수정 필요한 cross-cutting hard-code.
  async function handleExistingAccountSignIn() {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);

    const deviceId = useNotificationStore.getState().deviceId;
    if (deviceId) {
      try {
        await unregisterDevice(deviceId);
      } catch (err) {
        logHandledError('notices/landing-pre-unregister', err);
      }
    }

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

      const fcmToken = useNotificationStore.getState().fcmToken;
      if (deviceId && fcmToken) {
        const lang = useSettingsStore.getState().appLanguage;
        try {
          await initializeFirestoreNotifications({
            uid: user.uid,
            deviceId,
            token: fcmToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            appVersion: Constants.expoConfig?.version ?? '0.0.0',
            osLocale: lang === 'ko' ? 'ko' : 'en',
          });
        } catch (err) {
          logHandledError('notices/landing-post-signin-register', err);
        }
      }

      // 명시적 prefs read — listener 발화 기다리지 않고 즉시 분기 결정.
      // Offline 안전망: getPreferences가 throw하면 wizard로 misroute하지 말고
      // 명시 에러 표시.
      let prefs;
      try {
        prefs = await getPreferences(user.uid);
      } catch (readErr) {
        logHandledError('notices/landing-prefs-read', readErr);
        setSignInError(t('error.network'));
        return;
      }

      const restoredDeptIds = prefs?.pickerSelections?.dept ?? [];
      const hasOnboardingMarker = prefs?.onboardedAt != null;
      const hasUsableDept = restoredDeptIds.length > 0;

      if (hasOnboardingMarker && hasUsableDept) {
        useSettingsStore.getState().restoreOnboardingFromRemote({
          primaryDeptId: restoredDeptIds[0],
          interestDeptIds: restoredDeptIds.slice(1, 4),
        });
        // 게이트 자동 해제 → NoticesTabScreen 표시. router 호출 불필요.
      } else {
        // (1) 신규 가입자 (onboardedAt null) 또는 (2) corrupt state
        // (onboardedAt set but dept empty — Rules가 막지 않으므로 이론상
        // 가능). 둘 다 wizard로 보내는 게 안전 — corrupt state는 wizard
        // 완료 시 정상 시드로 self-heal됨.
        if (hasOnboardingMarker && !hasUsableDept) {
          logHandledError(
            'notices/landing-corrupt-prefs',
            new Error('onboardedAt set but pickerSelections.dept empty'),
          );
        }
        router.push('/onboarding');
      }
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            setSignInError(t('auth.domainNotAllowed'));
            break;
          case 'CANCELLED':
            break;
          case 'PLAY_SERVICES_UNAVAILABLE':
            setSignInError(t('auth.playServicesError'));
            break;
          default:
            setSignInError(t('auth.unknownError'));
        }
      } else {
        setSignInError(t('auth.unknownError'));
      }
    } finally {
      setSigningIn(false);
    }
  }

  const screenOptions = (
    <Stack.Screen
      options={{
        header: () => <NoticesHeader />,
      }}
    />
  );

  if (isAnonymous || !onboardingCompleted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <OnboardingLanding
          onStartPress={() => router.push('/onboarding')}
          onExistingAccountPress={handleExistingAccountSignIn}
          loading={signingIn}
          signInError={signInError}
        />
      </>
    );
  }

  return (
    <>
      {screenOptions}
      <NoticesTabScreen />
    </>
  );
}
