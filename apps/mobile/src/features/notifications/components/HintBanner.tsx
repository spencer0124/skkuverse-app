import { StyleSheet, View } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors } from '@skkuverse/shared';

interface HintBannerProps {
  message: string;
}

export function HintBanner({ message }: HintBannerProps) {
  return (
    <View style={styles.banner}>
      <Txt typography="t7" color={SdsColors.grey700}>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: SdsColors.grey50,
  },
});
