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
   * `null` is unknown, not flat: nothing has settled yet means the map is still
   * at its `initialCamera`, which carries the campus's own tilt and bearing —
   * and the natural-sciences campus is rotated. So an unknown attitude takes
   * the prop path, the only one that can set it; the cost is a first move
   * without its duration.
   */
  current: CameraAttitude | null;
  animate: (arg: CameraAnimateArg) => void;
  command: (arg: CameraCommandArg) => void;
}

/**
 * How close the map's attitude must be to the target's to count as already there.
 *
 * Not exact equality: the SDK reports a heading that it was told to set to 6 as
 * `6.000000000000001` (measured on the iOS simulator, 2026-09-26). An exact
 * comparison sent every bearing-6 chip down the prop path, which has no
 * duration, even when the map was already at 6.
 */
const ATTITUDE_TOLERANCE_DEG = 0.01;

/** The unsigned difference between two headings, in degrees, across north. */
function angleBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function moveCamera(
  target: MapChipCamera,
  { current, animate, command }: MoveCameraHandlers,
): void {
  const { lat, lng, zoom, tilt, bearing, durationMs } = target;

  const attitudeHolds =
    current !== null &&
    Math.abs((current.tilt ?? 0) - tilt) < ATTITUDE_TOLERANCE_DEG &&
    angleBetween(current.bearing ?? 0, bearing) < ATTITUDE_TOLERANCE_DEG;

  if (attitudeHolds) {
    animate({ latitude: lat, longitude: lng, zoom, duration: durationMs });
    return;
  }

  command({ latitude: lat, longitude: lng, zoom, tilt, bearing });
}

/** The fields of a `camera` prop order that the native side compares. */
export interface CameraOrder {
  latitude: number;
  longitude: number;
  zoom?: number;
  tilt?: number;
  bearing?: number;
}

/**
 * How far an order is nudged when it would repeat the previous one, in degrees
 * of latitude — about 0.1 mm on the ground.
 */
const REPEAT_NUDGE_DEG = 1e-9;

/**
 * The next `camera` prop order, made to differ from the one before it.
 *
 * The native side applies the prop only when it differs BY VALUE from the
 * previous prop (`RNCNaverMapView.mm:202`, `isCameraEqual` in `FnUtil.h:146`).
 * It compares against the last ORDER, not against where the map is now. So an
 * order that repeats the previous one is dropped with no error, even after the
 * user has panned away — which is how a second tap on the same chip came to do
 * nothing once its camera carried a bearing and took this path.
 *
 * A repeated order is sent with its latitude nudged by an invisible amount.
 * The one after that differs from the nudged one, so it goes out unchanged:
 * T, T+ε, T, … and no write ever equals the write before it.
 */
export function distinctCommand<T extends CameraOrder>(prev: CameraOrder | undefined, next: T): T {
  const repeats =
    prev !== undefined &&
    prev.latitude === next.latitude &&
    prev.longitude === next.longitude &&
    prev.zoom === next.zoom &&
    prev.tilt === next.tilt &&
    prev.bearing === next.bearing;
  return repeats ? { ...next, latitude: next.latitude + REPEAT_NUDGE_DEG } : next;
}
