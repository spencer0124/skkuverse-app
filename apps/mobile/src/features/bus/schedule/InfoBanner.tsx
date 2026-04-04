/**
 * Dismissable info banner — blue-tinted notification strip with X button.
 *
 * Design source: shuttle-v3.html (.banner)
 */

import { View, StyleSheet } from 'react-native';
import { Info } from 'lucide-react-native';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface InfoBannerProps {
  text: string;
}

export function InfoBanner({ text }: InfoBannerProps) {
  return (
    <View style={styles.container}>
      <Info size={16} color={SdsColors.blue600} />
      <Txt typography="t7" fontWeight="medium" color={SdsColors.blue600} style={styles.text}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: SdsColors.blue50,
    borderRadius: 10,
  },
  text: {
    flex: 1,
    lineHeight: 18,
  },

});
