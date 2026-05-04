import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserIcon } from 'phosphor-react-native';
import { Button, Dialog, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useAuthStore, useT } from '@skkuverse/shared';
import { signOutFromGoogle } from '@/services/google-auth';

const PHOTO_SIZE = 80;

export function AccountSettingsScreen() {
  const router = useRouter();
  const { t } = useT();

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const photoURL = useAuthStore((s) => s.photoURL);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);

  const showProfile = !isAnonymous || isSigningOut;
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = async () => {
    setShowSignOutDialog(false);
    await signOutFromGoogle();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showProfile ? (
          <>
            <View style={styles.hero}>
              <PhotoOrIcon photoURL={photoURL} />
              <View style={styles.identityBlock}>
                <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900}>
                  {displayName ?? ''}
                </Txt>
                {email ? (
                  <Txt typography="t6" color={SdsColors.grey500}>
                    {email}
                  </Txt>
                ) : null}
              </View>
            </View>

            <View style={styles.actionSection}>
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
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <PhotoOrIcon photoURL={null} />
              <View style={styles.identityBlock}>
                <Txt
                  typography="t2"
                  fontWeight="bold"
                  color={SdsColors.grey900}
                  textAlign="center"
                >
                  {t('auth.loginCardTitle')}
                </Txt>
                <Txt typography="t6" color={SdsColors.grey500} textAlign="center">
                  {t('auth.loginPrompt')}
                </Txt>
              </View>
            </View>

            <View style={styles.actionSection}>
              <Button
                type="dark"
                size="medium"
                display="block"
                onPress={() => router.push('/login')}
              >
                {t('auth.googleSignIn')}
              </Button>
            </View>
          </>
        )}
      </ScrollView>

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
    </View>
  );
}

function PhotoOrIcon({ photoURL }: { photoURL: string | null | undefined }) {
  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={styles.photo} />;
  }
  return (
    <View style={[styles.photo, styles.photoFallback]}>
      <UserIcon size={36} color={SdsColors.grey500} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: SdsSpacing.lg,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    gap: 16,
  },
  identityBlock: {
    alignItems: 'center',
    gap: 6,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
  },
  photoFallback: {
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    marginTop: 48,
  },
});
