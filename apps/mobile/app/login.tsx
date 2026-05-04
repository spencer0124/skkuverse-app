import { useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@skkuverse/sds';
import {
  SdsColors,
  SdsSpacing,
  authStore,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { signInWithGoogle, GoogleAuthError } from '@/services/google-auth';
import {
  getPreferences,
  initializeFirestoreNotifications,
  unregisterDevice,
} from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';
import { GoogleIcon } from '@/components/GoogleIcon';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);

    // Pre-unregister current (anon) device — mirror of signOutFromGoogle's
    // pattern. Without this the iOS anon→Google transition fails the
    // device-update Rule (path a needs uid match, path b needs active=false),
    // leaving the device stuck under the anon uid and breaking
    // syncPreferencesToDevices fan-out. See OnboardingScreen.handleSignIn
    // for the longer comment.
    const deviceId = useNotificationStore.getState().deviceId;
    if (deviceId) {
      try {
        await unregisterDevice(deviceId);
      } catch (err) {
        logHandledError('login/pre-unregister-anon-device', err);
      }
    }

    try {
      const result = await signInWithGoogle();
      // Android: linkWithCredential doesn't fire onAuthStateChanged
      // (same UID preserved), so manually sync the store.
      const user = result.user;
      authStore.getState().setAuthenticated({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        isAnonymous: user.isAnonymous,
      });

      // Re-register device under the post-signin uid synchronously so
      // syncPreferencesToDevices fan-out finds the device on subsequent
      // toggles (rather than racing against useAppInit's async migration).
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
          logHandledError('login/post-signin-register', err);
        }
      }

      // Listener fallback (useAppInit.ts:240) handles cold-start, but
      // sign-in 직후 명시 read는 router.back() 전에 게이트 flag를 동기 갱신
      // → returning user가 직전 게이트 화면으로 돌아갈 때 flicker 차단.
      // 신규 가입자는 wizard로 명시 라우팅 (router.back()이면 onboarding
      // 미완 상태로 게이트가 그대로 남음). Mirror of notices/index.tsx
      // handleExistingAccountSignIn — 핸들러 통합은 후속 PR.
      let prefs;
      try {
        prefs = await getPreferences(user.uid);
      } catch (readErr) {
        logHandledError('login/prefs-read', readErr);
        // Offline: listener fallback에 위임. 신규/기존 분기 불가하므로
        // back으로 돌려보내서 호출자 컨텍스트 보존.
        router.back();
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
        router.back();
      } else {
        if (hasOnboardingMarker && !hasUsableDept) {
          logHandledError(
            'login/corrupt-prefs',
            new Error('onboardedAt set but pickerSelections.dept empty'),
          );
        }
        // 신규 가입자 or corrupt state → wizard. router.replace로 login
        // 화면을 stack에서 제거하여 wizard 완료 후 dismissAll이 호출자 화면
        // 컨텍스트로 자연 복귀. AnonymousGate (router.replace 진입) 경로에선
        // 알림 설정 화면이 stack에서 이미 사라진 상태라 settings 탭 루트로 복귀.
        router.replace('/onboarding');
      }
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            setErrorMessage(t('auth.domainNotAllowed'));
            break;
          case 'CANCELLED':
            break;
          case 'PLAY_SERVICES_UNAVAILABLE':
            setErrorMessage(t('auth.playServicesError'));
            break;
          default:
            setErrorMessage(t('auth.unknownError'));
        }
      } else {
        setErrorMessage(t('auth.unknownError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.logo}
          />
          <Text style={styles.title}>{t('auth.loginTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            type="dark"
            size="big"
            display="block"
            loading={loading}
            onPress={handleSignIn}
            leftAccessory={<GoogleIcon size={20} />}
          >
            {t('auth.googleSignIn')}
          </Button>

          {errorMessage && (
            <Text style={styles.error}>{errorMessage}</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: SdsSpacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: SdsColors.grey900,
    marginBottom: SdsSpacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: SdsColors.grey500,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    gap: SdsSpacing.md,
  },
  error: {
    fontSize: 14,
    color: SdsColors.red500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
