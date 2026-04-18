import { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { Txt, Button, Dialog } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useAuthStore, useT } from '@skkuverse/shared';
import { signOutFromGoogle } from '@/services/google-auth';

export function MoreScreen() {
  const { t } = useT();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);
  const photoURL = useAuthStore((s) => s.photoURL);

  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = async () => {
    setShowSignOutDialog(false);
    await signOutFromGoogle();
  };

  // Show profile if signed in (or during sign-out to prevent flicker)
  const showProfile = !isAnonymous || isSigningOut;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Txt typography="t3" fontWeight="bold">
          {t('nav.more')}
        </Txt>
      </View>

      {showProfile ? (
        <View style={styles.profileCard}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <User size={28} color={SdsColors.grey500} />
            </View>
          )}
          <View style={styles.profileText}>
            <Txt typography="t5" fontWeight="semibold" color={SdsColors.grey900}>
              {displayName ?? ''}
            </Txt>
            <Txt typography="t7" color={SdsColors.grey500}>
              {email ?? ''}
            </Txt>
          </View>
        </View>
      ) : (
        <View style={styles.loginCard}>
          <Txt typography="t6" color={SdsColors.grey500} style={styles.loginPrompt}>
            {t('auth.loginPrompt')}
          </Txt>
          <Button
            type="primary"
            size="medium"
            onPress={() => router.push('/login')}
          >
            {t('auth.googleSignIn')}
          </Button>
        </View>
      )}

      {showProfile && (
        <View style={styles.section}>
          <Button
            type="danger"
            style="weak"
            size="medium"
            display="block"
            onPress={() => setShowSignOutDialog(true)}
          >
            {t('auth.signOut')}
          </Button>
        </View>
      )}

      <Dialog.Confirm
        open={showSignOutDialog}
        description={t('auth.signOutConfirm')}
        onClose={() => setShowSignOutDialog(false)}
        leftButton={
          <Button
            type="dark"
            style="weak"
            size="medium"
            display="block"
            onPress={() => setShowSignOutDialog(false)}
          >
            {t('common.close')}
          </Button>
        }
        rightButton={
          <Button
            type="danger"
            size="medium"
            display="block"
            onPress={handleSignOut}
          >
            {t('auth.signOut')}
          </Button>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.lg,
    gap: SdsSpacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  loginCard: {
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.xxl,
    gap: SdsSpacing.lg,
  },
  loginPrompt: {
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.md,
  },
});
