import { StyleSheet, View } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';

interface Props {
  userName: string;
}

export function CompletionStep({ userName }: Props) {
  const { t, tpl } = useT();
  const displayName = userName || '사용자';

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <CircleCheck size={48} color={SdsColors.green500} />
      </View>
      <Txt typography="t1" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {tpl('onboarding.completionTitle', displayName)}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500}>
        {t('onboarding.completionSubtitle')}
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
