/**
 * Heading compass, shown while the map follows the user's facing direction.
 *
 * Drawn here rather than switched on in the SDK. `isShowCompass` is a bare
 * boolean with no placement control — only the Naver logo has an align prop
 * (`LogoAlign.ts`) — and this one has to sit directly above the locate button
 * and ride the bottom sheet with it. A component we position ourselves is the
 * only way to put it there.
 *
 * Rotation comes off a shared value, so a pan rotates the needle on the UI
 * thread without re-rendering the map screen on every frame.
 */

import { StyleSheet, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { SdsColors } from '@skkuverse/shared';
import { GlassSurface } from '@/components/glass';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';

interface MapCompassProps {
  /** Camera heading in degrees, clockwise from north. */
  bearing: SharedValue<number>;
  /** Rotate the map back to north-up. */
  onPress: () => void;
  label: string;
}

export function MapCompass({ bearing, onPress, label }: MapCompassProps) {
  // Negated: `bearing` is where the CAMERA looks, so a camera turned 90° east
  // has to swing the needle 90° west for it to keep pointing at true north.
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-bearing.value}deg` }],
  }));

  return (
    <GlassSurface style={styles.surface}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pressable}
      >
        <Animated.View style={[styles.needle, needleStyle]}>
          <Svg width={22} height={22} viewBox="0 0 22 22">
            {/* Two half-needles sharing a waist, so the north half can be red
                and the south half grey without a seam between them. */}
            <Polygon points="11,1 15,11 11,11 7,11" fill={SdsColors.red500} />
            <Polygon points="11,21 15,11 11,11 7,11" fill={SdsColors.grey400} />
          </Svg>
        </Animated.View>
        {/* Outside the rotating view: the letter marks the housing, not the
            needle, so it must stay upright as the map turns. */}
        <Text style={styles.north}>N</Text>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: MAP_CONTROL_HEIGHT,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  north: {
    position: 'absolute',
    top: 2,
    fontSize: 8,
    fontWeight: '700',
    color: SdsColors.grey600,
  },
});
