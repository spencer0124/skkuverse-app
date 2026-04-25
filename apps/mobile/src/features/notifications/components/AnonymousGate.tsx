import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import { ScreenHeader } from './ScreenHeader';

export function AnonymousGate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t('notifications.settings')} onBack={() => router.back()} />
      <View style={styles.body}>
        <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
          {t('notifications.loginRequired')}
        </Txt>
        <View style={{ height: SdsSpacing.lg }} />
        <Button
          type="primary"
          size="medium"
          display="block"
          onPress={() => router.replace('/login')}
        >
          {t('notifications.loginCta')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});
