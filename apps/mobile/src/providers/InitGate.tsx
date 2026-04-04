import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SdsColors, SdsTypo, SdsSpacing, useT } from '@skkuverse/shared';
import { useAppInit } from '@/hooks/useAppInit';

/**
 * Init gate — blocks navigation tree until app initialization completes.
 *
 * Shows a loading indicator during init, or an error screen if init fails
 * (e.g., no network for Firebase anonymous auth).
 *
 * Placed inside QueryProvider but wrapping the navigation Stack,
 * so screens only render after auth is ready.
 */
export function InitGate({ children }: { children: ReactNode }) {
  const { isReady, error } = useAppInit();
  const { t } = useT();

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('error.appStart')}</Text>
        <Text style={styles.subtitle}>
          {t('error.checkNetwork')}
        </Text>
        {__DEV__ && <Text style={styles.debug}>{error}</Text>}
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={SdsColors.grey400} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SdsColors.grey50,
    padding: SdsSpacing.xl,
  },
  title: {
    fontFamily: SdsTypo.t4.fontFamily,
    fontSize: SdsTypo.t4.fontSize,
    lineHeight: SdsTypo.t4.lineHeight,
    fontWeight: SdsTypo.t4.fontWeight,
    color: SdsColors.grey900,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: SdsTypo.t6.fontFamily,
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: SdsTypo.t6.fontWeight,
    color: SdsColors.grey500,
    textAlign: 'center',
    marginTop: SdsSpacing.sm,
  },
  debug: {
    fontFamily: SdsTypo.t7.fontFamily,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: SdsTypo.t7.fontWeight,
    color: SdsColors.red500,
    textAlign: 'center',
    marginTop: SdsSpacing.base,
  },
});
