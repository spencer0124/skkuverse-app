import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import { GoogleAuthError } from '@/services/google-auth';
import {
  signInWithDeviceMigration,
  classifyAndRestoreOnboarding,
} from '@/services/auth-flow';
import { GoogleIcon } from '@/components/GoogleIcon';
import { logAuthEvent } from '@/services/analytics';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    logAuthEvent({ event: 'signin_attempt', surface: 'login_screen' });
    try {
      const user = await signInWithDeviceMigration('login');
      logAuthEvent({ event: 'signin_success', surface: 'login_screen' });
      const result = await classifyAndRestoreOnboarding(user.uid, 'login');
      switch (result.kind) {
        case 'restored':
        case 'read-failed':
          // restored: 게이트 flag 동기 갱신 후 호출자 복귀.
          // read-failed: offline 등 — listener fallback (useAppInit.ts:240)
          // 이 곧 자동 unlock 시도. 호출자 컨텍스트 보존이 toast보다 자연.
          router.back();
          break;
        case 'new':
          // 신규 가입자 → wizard 진입. router.replace로 login 화면 stack
          // 제거하여 wizard dismissAll이 호출자 컨텍스트로 자연 복귀.
          router.replace('/onboarding');
          break;
      }
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            logAuthEvent({ event: 'signin_domain_rejected', surface: 'login_screen' });
            setErrorMessage(t('auth.domainNotAllowed'));
            break;
          case 'CANCELLED':
            logAuthEvent({ event: 'signin_cancel', surface: 'login_screen' });
            break;
          case 'PLAY_SERVICES_UNAVAILABLE':
            logAuthEvent({ event: 'signin_error', surface: 'login_screen', detail: 'play_services' });
            setErrorMessage(t('auth.playServicesError'));
            break;
          default:
            logAuthEvent({ event: 'signin_error', surface: 'login_screen', detail: err.code });
            setErrorMessage(t('auth.unknownError'));
        }
      } else {
        logAuthEvent({ event: 'signin_error', surface: 'login_screen', detail: 'unknown' });
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
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
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
    lineHeight: 30,
    color: SdsColors.grey900,
    marginBottom: SdsSpacing.sm,
    textAlign: 'center',
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
