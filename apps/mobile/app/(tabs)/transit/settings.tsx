import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SdsColors, useT } from '@skkuverse/shared';

export default function TransitSettingsScreen() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <View style={styles.container}>
        <Text style={styles.text}>{t('settings.title')}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.background,
  },
  text: {
    fontSize: 16,
    color: SdsColors.grey500,
  },
});
