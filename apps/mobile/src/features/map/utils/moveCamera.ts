/**
 * Move the map camera, picking the mechanism the target actually needs.
 *
 * The Naver SDK splits a camera across two, and neither carries all of it:
 *
 * - `NaverMapViewRef.animateCameraTo` takes `{latitude, longitude, zoom,
 *   duration, easing, pivot}` and **not** `tilt` or `bearing`.
 * - the declarative `camera` prop carries `tilt` and `bearing` and has **no**
 *   duration.
 *
 * So the question is not "is the target flat" — it is **does the attitude have
 * to change**. When the map is already at the target's tilt and bearing, the
 * imperative path is correct and is the one that honours `durationMs`; when it
 * is not, only the prop can get there.
 *
 * Testing the target against zero instead is a trap worth naming, because it
 * looks right and fails silently: rotate the map, tap a chip whose camera says
 * `bearing: 0`, and the imperative path flies to the target STILL ROTATED,
 * because it has no way to say "bearing 0". The server declared an attitude and
 * the map quietly ignored it, with no error on either side.
 *
 * The server sends the whole motion regardless — this is a client mechanism
 * limit, and trimming the wire to match it would bake the limitation into the
 * contract.
 *
 * Written against two callbacks rather than against a `NaverMapViewRef`, so the
 * choice is testable under plain Node with no SDK in the room.
 */

import type { MapChipCamera } from '@skkuverse/shared';

/** What `animateCameraTo` accepts, spelled out rather than imported from the SDK. */
export interface CameraAnimateArg {
  latitude: number;
  longitude: number;
  zoom: number;
  duration: number;
}

/** What the declarative `camera` prop accepts. */
export interface CameraCommandArg {
  latitude: number;
  longitude: number;
  zoom: number;
  tilt: number;
  bearing: number;
}

/** As much of the map's current camera as the choice depends on. */
export interface CameraAttitude {
  tilt?: number;
  bearing?: number;
}

export interface MoveCameraHandlers {
  /**
   * The map's attitude right now, or `null` when it has not reported a camera.
   *
   * `null` is read as flat rather than as unknown, and that is a fact about
   * this app rather than a guess: nothing has settled yet means the map is
   * still at its `initialCamera`, which is built from a campus definition, and
   * every campus ships `defaultTilt` and `defaultBearing` of 0.
   */
  current: CameraAttitude | null;
  animate: (arg: CameraAnimateArg) => void;
  command: (arg: CameraCommandArg) => void;
}

export function moveCamera(
  target: MapChipCamera,
  { current, animate, command }: MoveCameraHandlers,
): void {
  const { lat, lng, zoom, tilt, bearing, durationMs } = target;

  const attitudeHolds =
    (current?.tilt ?? 0) === tilt && (current?.bearing ?? 0) === bearing;

  if (attitudeHolds) {
    animate({ latitude: lat, longitude: lng, zoom, duration: durationMs });
    return;
  }

  command({ latitude: lat, longitude: lng, zoom, tilt, bearing });
}
