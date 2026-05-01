import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';

export default function TosRoute() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.tos') }} />
      <View style={styles.container} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
});
