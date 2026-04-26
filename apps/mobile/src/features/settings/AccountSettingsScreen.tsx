/**
 * Account settings — profile pill capsule (photo + name) with email below.
 *
 * iOS 26+: outer pill is a Liquid Glass material (`GlassView`). Photo inside
 * is a plain circular Image (no nested glass ring — would conflict with the
 * pill capsule per HIG).
 * iOS<26 / Android: solid white pill with a subtle shadow.
 */

import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRightIcon, UserIcon } from 'phosphor-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useAuthStore, useT } from '@skkuverse/shared';

const GLASS_AVAILABLE = isLiquidGlassAvailable();
const PHOTO_SIZE = 56;

export function AccountSettingsScreen() {
  const router = useRouter();
  const { t } = useT();

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const photoURL = useAuthStore((s) => s.photoURL);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);

  const showProfile = !isAnonymous || isSigningOut;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showProfile ? (
          <>
            <ProfilePill>
              <PhotoOrIcon photoURL={photoURL} />
              <View style={styles.nameWrap}>
                <Txt
                  typography="t4"
                  fontWeight="semibold"
                  color={SdsColors.grey900}
                >
                  {displayName ?? ''}
                </Txt>
              </View>
            </ProfilePill>
            {email ? (
              <Txt typography="t6" color={SdsColors.grey500}>
                {email}
              </Txt>
            ) : null}
          </>
        ) : (
          <>
            <ProfilePill onPress={() => router.push('/login')}>
              <PhotoOrIcon photoURL={null} />
              <View style={styles.nameWrap}>
                <Txt
                  typography="t4"
                  fontWeight="semibold"
                  color={SdsColors.grey900}
                >
                  {t('auth.loginCardTitle')}
                </Txt>
              </View>
              <CaretRightIcon size={20} color={SdsColors.grey400} />
            </ProfilePill>
            <Txt typography="t6" color={SdsColors.grey500}>
              {t('auth.loginPrompt')}
            </Txt>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PhotoOrIcon({ photoURL }: { photoURL: string | null | undefined }) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          borderRadius: PHOTO_SIZE / 2,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: PHOTO_SIZE / 2,
        backgroundColor: SdsColors.grey100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <UserIcon size={28} color={SdsColors.grey500} />
    </View>
  );
}

interface ProfilePillProps {
  children: React.ReactNode;
  onPress?: () => void;
}

function ProfilePill({ children, onPress }: ProfilePillProps) {
  const inner = onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillContent,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={styles.pillContent}>{children}</View>
  );

  if (GLASS_AVAILABLE) {
    return (
      <View style={[styles.pillOuter, glassStyles.shadow]}>
        <GlassView style={styles.pillSurface} glassEffectStyle="regular">
          {inner}
        </GlassView>
      </View>
    );
  }

  return (
    <View style={[styles.pillOuter, styles.pillFallback, glassStyles.shadow]}>
      {inner}
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
    paddingTop: SdsSpacing.xl,
    paddingHorizontal: SdsSpacing.lg,
    paddingBottom: 32,
    gap: SdsSpacing.sm,
  },
  pillOuter: {
    borderRadius: 999,
  },
  pillSurface: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillFallback: {
    backgroundColor: '#fff',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    gap: SdsSpacing.md,
  },
  nameWrap: {
    flex: 1,
  },
});

const glassStyles = StyleSheet.create({
  shadow: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
