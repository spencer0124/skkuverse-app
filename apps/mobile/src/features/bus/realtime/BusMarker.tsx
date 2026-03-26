/**
 * Bus marker — absolutely positioned on the station list.
 *
 * Position calc (from businfo_component.dart):
 *   top = stationIndex >= lastStationIndex
 *     ? 26 + 66 * stationIndex
 *     : elapsed > 200
 *       ? 26 + 66 * stationIndex + 40
 *       : 26 + 66 * stationIndex + elapsed / 5
 *   left = 0, width = LEFT_PADDING (centered on timeline)
 *
 * `elapsed` starts from `bus.estimatedTime`, incremented every 1s via setInterval.
 * Resets when `bus.estimatedTime` changes (new poll data).
 *
 * Flutter source: lib/features/transit/widgets/businfo_component.dart
 */

import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { RealtimeBus } from '@skkuuniverse/shared';
import { LicensePlate } from './LicensePlate';
import { PulseAnimation } from './PulseAnimation';
import { STATION_ROW_HEIGHT, LEFT_PADDING } from './StationRow';

const VERTICAL_CENTER = 26;
const PULSE_SIZE = 28;

interface BusMarkerProps {
  bus: RealtimeBus;
  lastStationIndex: number;
  color: string;
}

export function BusMarker({ bus, lastStationIndex, color }: BusMarkerProps) {
  const [elapsed, setElapsed] = useState(bus.estimatedTime);
  const prevEstimatedTime = useRef(bus.estimatedTime);

  // Reset elapsed when poll data changes
  useEffect(() => {
    if (bus.estimatedTime !== prevEstimatedTime.current) {
      setElapsed(bus.estimatedTime);
      prevEstimatedTime.current = bus.estimatedTime;
    }
  }, [bus.estimatedTime]);

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
      <LicensePlate carNumber={bus.carNumber} color={color} />
      <View style={styles.spacer} />
      <View style={styles.pulseContainer}>
        <PulseAnimation color={color} size={PULSE_SIZE} />
        <View style={[styles.innerDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    width: LEFT_PADDING,
    alignItems: 'center',
  },
  spacer: {
    height: 5,
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
  },
});
