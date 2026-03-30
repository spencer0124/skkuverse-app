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

interface Props {
  section: BannerType;
}

export function Banner({ section }: Props) {
  return (
    <Pressable
      style={styles.container}
      onPress={() =>
        handleSduiAction({
          actionType: section.actionType,
          actionValue: section.actionValue,
        })
      }
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
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
  },
});
