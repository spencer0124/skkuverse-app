import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BellRingingIcon, CaretRightIcon } from 'phosphor-react-native';
import { Button, Dialog, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useAuthStore, useT } from '@skkuverse/shared';
import { signOutFromGoogle } from '@/services/google-auth';

export function SettingsScreen() {
  const router = useRouter();
  const { t } = useT();

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const showSignOut = !isAnonymous || isSigningOut;

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
        <Pressable
          style={({ pressed }) => [
            styles.settingsRow,
            pressed && styles.settingsRowPressed,
          ]}
          onPress={() => router.push('/notifications/settings' as never)}
        >
          <View style={styles.settingsIconWrap}>
            <BellRingingIcon size={20} color={SdsColors.grey700} />
          </View>
          <View style={styles.settingsTextWrap}>
            <Txt typography="t5" fontWeight="regular" color={SdsColors.grey900}>
              {t('notifications.settings')}
            </Txt>
          </View>
          <CaretRightIcon size={18} color={SdsColors.grey400} />
        </Pressable>

        {showSignOut && (
          <View style={styles.signOutSection}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    gap: SdsSpacing.md,
  },
  settingsRowPressed: {
    backgroundColor: SdsColors.grey50,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: {
    flex: 1,
  },
  signOutSection: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.lg,
  },
});
