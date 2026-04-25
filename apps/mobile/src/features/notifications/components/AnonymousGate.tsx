import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

export function AnonymousGate() {
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={styles.container}>
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
