/**
 * Bus icon — maps `iconType` to a local SVG asset or remote image.
 *
 * Known types ('shuttle', 'village') use bundled toss-style SVG icons.
 * Unknown types are treated as remote image URLs with fallback to default bus icon.
 *
 * Flutter source: lib/features/transit/widgets/busrow.dart (icon logic)
 */

import { useState } from 'react';
import { Image } from 'expo-image';

const SHUTTLE_ICON = require('../../../assets/icons/toss_bus_skkubus.svg');
const VILLAGE_ICON = require('../../../assets/icons/toss_bus_citybus.svg');
const DEFAULT_ICON = require('../../../assets/icons/toss_bus_default.svg');

const ICON_MAP: Record<string, number> = {
  shuttle: SHUTTLE_ICON as number,
  village: VILLAGE_ICON as number,
};

interface BusIconProps {
  iconType: string;
  size?: number;
}

export function BusIcon({ iconType, size = 28 }: BusIconProps) {
  const [hasError, setHasError] = useState(false);
  const localIcon = ICON_MAP[iconType];

  if (localIcon) {
    return (
      <Image
        source={localIcon}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  // URL-based icon with error fallback to default bus icon
  return (
    <Image
      source={hasError ? DEFAULT_ICON : { uri: iconType }}
      style={{ width: size, height: size }}
      contentFit="contain"
      onError={() => setHasError(true)}
    />
  );
}
