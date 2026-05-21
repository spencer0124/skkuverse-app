/**
 * Bus marker — absolutely positioned on the station list.
 *
 * Layout: row [LicensePlate | BusDot], spanning PLATE_GUTTER + LEFT_PADDING.
 * Plate sits in the gutter (right-aligned), dot stays centered on timeline.
 *
 * Position calc (from businfo_component.dart, VERTICAL_CENTER bumped 26→45
 * to compensate for column→row restructure so dot Y stays constant):
 *   top = stationIndex >= lastStationIndex
 *     ? 45 + 66 * stationIndex
 *     : elapsed > 200
 *       ? 45 + 66 * stationIndex + 40
 *       : 45 + 66 * stationIndex + elapsed / 5
 *
 * `elapsed` starts from `bus.estimatedTime`, incremented every 1s via setInterval.
 * Resets when `bus.estimatedTime` changes (new poll data).
 *
 * Flutter source: lib/features/transit/widgets/businfo_component.dart
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { RealtimeBus } from '@skkuverse/shared';
import { BusIcon } from 'phosphor-react-native';
import { LicensePlate } from './LicensePlate';
import { PulseAnimation } from './PulseAnimation';
import { STATION_ROW_HEIGHT, LEFT_PADDING, PLATE_GUTTER } from './StationRow';

const VERTICAL_CENTER = 45;
const PULSE_SIZE = 28;

interface BusMarkerProps {
  bus: RealtimeBus;
  lastStationIndex: number;
  color: string;
  /** Monotonic counter bumped on each poll — forces elapsed reset even when estimatedTime is unchanged. */
  pollGeneration: number;
}

export function BusMarker({ bus, lastStationIndex, color, pollGeneration }: BusMarkerProps) {
  const [elapsed, setElapsed] = useState(bus.estimatedTime);

  // Reset elapsed whenever new poll data arrives (pollGeneration changes),
  // not just when estimatedTime differs. Covers the edge case where a bus
  // is stationary and estimatedTime stays the same across consecutive polls.
  useEffect(() => {
    setElapsed(bus.estimatedTime);
  }, [pollGeneration, bus.estimatedTime]);

  // Increment elapsed every second
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Calculate vertical position
  const baseTop = VERTICAL_CENTER + STATION_ROW_HEIGHT * bus.stationIndex;
  let animationOffset: number;
  if (bus.stationIndex >= lastStationIndex) {
    animationOffset = 0;
  } else if (elapsed > 200) {
    animationOffset = 40;
  } else {
    animationOffset = elapsed / 5;
  }

  return (
    <View
      style={[
        styles.container,
        { top: baseTop + animationOffset },
      ]}
    >
      <View style={styles.plateColumn}>
        <LicensePlate carNumber={bus.carNumber} color={color} />
      </View>
      <View style={styles.pulseContainer}>
        <PulseAnimation color={color} size={PULSE_SIZE} />
        <View style={[styles.innerDot, { backgroundColor: color }]}>
          <BusIcon size={14} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    // Reach from screen-left to dot's right edge: dot center is on the
    // timeline at PLATE_GUTTER + LEFT_PADDING/2, plus dot's half-width.
    width: PLATE_GUTTER + LEFT_PADDING / 2 + PULSE_SIZE / 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateColumn: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  pulseContainer: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
