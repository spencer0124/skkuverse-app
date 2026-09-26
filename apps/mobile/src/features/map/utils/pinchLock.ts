/**
 * Whether the map may scroll during the current pinch.
 *
 * A pinch on a following map drops tracking — the SDK does that for any
 * gesture, and that part is fine. What is not fine is where it zooms: about the
 * fingers, not the dot, so the dot slides up the screen on a pinch-out and down
 * on a pinch-in. With scroll off, nothing can move the camera target, and the
 * SDK zooms about the target — which, while tracking, is the dot.
 *
 * The lock is decided the moment the second finger lands, from whether the map
 * was following THEN, and held until every finger is up. Two measured reasons it
 * cannot track the live mode instead:
 *
 * - The SDK reports the drop to NoFollow at the start of the pinch, so a lock
 *   derived from the live mode would let go of scroll halfway through it.
 * - Handing scroll back mid-gesture does nothing anyway: the SDK decides what a
 *   gesture may do when it begins. Turning scroll OFF at the second finger is
 *   early enough, because a pinch has not begun by then.
 *
 * One finger never locks, so a drag still pans from its first frame and ends
 * tracking as the SDK intends. A pinch that ends by dragging the last finger
 * stays locked, or its tail would slide the dot after all.
 *
 * Imports nothing, so it runs under plain `node --test`.
 */

export interface PinchLock {
  /** Two fingers have been down since the last time every finger was up. */
  pinching: boolean;
  /** Scroll is off for this pinch. */
  locked: boolean;
}

export const NO_PINCH: PinchLock = { pinching: false, locked: false };

/**
 * One touch event forward. `touches` is the count still down, which on an end
 * event excludes the finger that lifted. Returns the SAME object when nothing
 * changed, because this runs on every touch move and the caller re-renders only
 * on a new one.
 */
export function stepPinchLock(s: PinchLock, touches: number, following: boolean): PinchLock {
  if (touches === 0) return s.pinching ? NO_PINCH : s;
  if (touches >= 2 && !s.pinching) return { pinching: true, locked: following };
  return s;
}
