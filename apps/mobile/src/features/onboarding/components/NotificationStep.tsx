import { StyleSheet, View } from 'react-native';
import { BellRingingIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';

export function NotificationStep() {
  const { t } = useT();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <BellRingingIcon size={48} color={SdsColors.green500} weight="fill" />
      </View>
      <Txt
        typography="t1"
        fontWeight="bold"
        color={SdsColors.grey900}
        style={styles.title}
      >
        {t('onboarding.notificationTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500}>
        {t('onboarding.notificationDescription')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: SdsColors.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    marginBottom: 14,
  },
});
