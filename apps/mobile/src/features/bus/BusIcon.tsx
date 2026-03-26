/**
 * Bus icon — maps `iconType` to an emoji or remote image.
 *
 * Flutter source: lib/features/transit/widgets/busrow.dart (icon logic)
 */

import { Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface BusIconProps {
  iconType: string;
  size?: number;
}

const ICON_MAP: Record<string, string> = {
  shuttle: '🚌',
  village: '🚐',
};

export function BusIcon({ iconType, size = 28 }: BusIconProps) {
  const emoji = ICON_MAP[iconType];

  if (emoji) {
    return <Text style={[styles.emoji, { fontSize: size }]}>{emoji}</Text>;
  }

  // URL-based icon
  return (
    <Image
      source={{ uri: iconType }}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  emoji: {
    textAlign: 'center',
  },
});
