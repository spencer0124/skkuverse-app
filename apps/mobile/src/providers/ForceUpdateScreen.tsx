import { useEffect } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SdsColors, SdsTypo, SdsSpacing, SdsRadius, useT } from '@skkuverse/shared';

interface Props {
  updateUrl: string | null;
}

export function ForceUpdateScreen({ updateUrl }: Props) {
  const { t } = useT();

  // Block Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handlePress = () => {
    if (updateUrl) {
      Linking.openURL(updateUrl);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('update.required')}</Text>
      <Text style={styles.message}>{t('update.message')}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handlePress}
      >
        <Text style={styles.buttonText}>{t('update.goToStore')}</Text>
      </Pressable>
    </View>
  );
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
    fontFamily: SdsTypo.t3.fontFamily,
    fontSize: SdsTypo.t3.fontSize,
    lineHeight: SdsTypo.t3.lineHeight,
    fontWeight: SdsTypo.t3.fontWeight,
    color: SdsColors.grey900,
    textAlign: 'center',
  },
  message: {
    fontFamily: SdsTypo.t6.fontFamily,
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: SdsTypo.t6.fontWeight,
    color: SdsColors.grey500,
    textAlign: 'center',
    marginTop: SdsSpacing.sm,
  },
  button: {
    marginTop: SdsSpacing.xl,
    backgroundColor: SdsColors.green500,
    paddingVertical: SdsSpacing.md,
    paddingHorizontal: SdsSpacing.xxl,
    borderRadius: SdsRadius.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontFamily: SdsTypo.t5.fontFamily,
    fontSize: SdsTypo.t5.fontSize,
    lineHeight: SdsTypo.t5.lineHeight,
    fontWeight: SdsTypo.t5.fontWeight,
    color: SdsColors.background,
    textAlign: 'center',
  },
});
