/**
 * Dismissable info banner — blue-tinted notification strip with X button.
 *
 * Design source: shuttle-v3.html (.banner)
 */

import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface InfoBannerProps {
  text: string;
  onDismiss: () => void;
}

export function InfoBanner({ text, onDismiss }: InfoBannerProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name="info-outline" size={16} color={SdsColors.blue600} />
      <Txt typography="t7" fontWeight="medium" color={SdsColors.blue600} style={styles.text}>
        {text}
      </Txt>
      <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
        <MaterialIcons name="close" size={14} color={SdsColors.blue500} />
      </Pressable>
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
  dismiss: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    opacity: 0.45,
  },
});
