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

      router.back();
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
