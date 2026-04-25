import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LockIcon } from 'phosphor-react-native';
import { Txt, Button } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';

interface Props {
  description: string;
  onLoginPress: () => void;
}

export function NoticeLoginGate({ description, onLoginPress }: Props) {
  const { t } = useT();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <LockIcon size={40} color={SdsColors.grey400} />
        <Txt typography="t5" color={SdsColors.grey600} style={styles.description}>
          {description}
        </Txt>
        <Button
          type="primary"
          size="medium"
          onPress={onLoginPress}
        >
          {t('auth.googleSignIn')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.lg,
    paddingHorizontal: SdsSpacing.xl,
  },
  description: {
    textAlign: 'center',
  },
});
