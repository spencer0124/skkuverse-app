/**
 * SDUI Banner — image banner with action on tap.
 *
 * Uses expo-image for efficient loading/caching.
 * Aspect ratio hardcoded to 16/9 (Flutter auto-sizes from image dimensions).
 *
 * Flutter source: sdui_banner_widget.dart
 */

import { Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { type SduiBanner as BannerType } from '@skkuverse/shared';
import { handleSduiAction } from '../action-handler';
import { logSduiContentSelect } from '@/services/analytics';

interface Props {
  section: BannerType;
}

export function Banner({ section }: Props) {
  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        logSduiContentSelect({ content_type: 'banner', item_id: section.actionValue });
        handleSduiAction({
          actionType: section.actionType,
          actionValue: section.actionValue,
        });
      }}
    >
      <Image
        source={section.imageUrl}
        style={styles.image}
        contentFit="cover"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
  },
});
