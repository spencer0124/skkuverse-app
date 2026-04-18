import { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import { signInWithGoogle, GoogleAuthError } from '@/services/google-auth';
import { GoogleIcon } from '@/components/GoogleIcon';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
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
