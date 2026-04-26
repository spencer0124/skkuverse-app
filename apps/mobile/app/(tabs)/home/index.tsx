import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DotsThreeIcon, UserIcon } from 'phosphor-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsColors, useAuthStore, useT } from '@skkuverse/shared';
import { HomeScreen } from '@/features/home/HomeScreen';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

/**
 * Home tab — native header hidden; two floating Liquid Glass capsules at
 * top-right (avatar + ⋯ settings). Avatar shows the user's photo only
 * (name lives on the account-settings page). Each capsule is a separate
 * GlassView so iOS 26 paints two distinct Liquid Glass pills.
 */
export default function HomeTab() {
  useTabFocusTracking('home');
  const router = useRouter();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const photoURL = useAuthStore((s) => s.photoURL);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeScreen />
      <View
        style={[styles.headerRow, { top: insets.top + 4 }]}
        pointerEvents="box-none"
      >
        <CircleCapsule
          onPress={() => router.push('/settings/account' as never)}
          accessibilityLabel={t('settings.account')}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImage} />
          ) : (
            <UserIcon size={20} color={SdsColors.grey800} />
          )}
        </CircleCapsule>
        <CircleCapsule
          onPress={() => router.push('/settings' as never)}
          accessibilityLabel={t('settings.title')}
        >
          <DotsThreeIcon size={24} color={SdsColors.grey800} weight="bold" />
        </CircleCapsule>
      </View>
    </>
  );
}

interface CircleCapsuleProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}

function CircleCapsule({
  children,
  onPress,
  accessibilityLabel,
}: CircleCapsuleProps) {
  if (GLASS_AVAILABLE) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.circleWrap,
          { transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}
      >
        <GlassView
          style={styles.circleSurface}
          glassEffectStyle="regular"
          isInteractive
        >
          {children}
        </GlassView>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.circleWrap,
        styles.circleFallback,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  circleWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSurface: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFallback: {
    backgroundColor: '#fff',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
