/**
 * Current-location tracking for the campus map.
 *
 * Deliberately thin. The Naver SDK already owns the hard parts — the location
 * dot, the direction cone, camera follow and heading follow are all native, and
 * selected with a single `setLocationTrackingMode` call
 * (`ios/RNCNaverMapView.mm:410` maps the four modes onto NMFMyPosition*). So
 * this hook does not fetch coordinates or draw an overlay; it handles
 * permission, and it decides which mode a tap moves to.
 *
 * ## The map is the source of truth for the mode, not this hook
 *
 * Any camera move — a user gesture OR our own — silently downgrades
 * `Follow`/`Face` to `NoFollow` inside the SDK. State that only changed when
 * the button was tapped would therefore claim to be following while the map had
 * already stopped, and the button would light up over a map that no longer
 * tracks anything.
 *
 * `onOptionChanged` fires with the real mode on both platforms
 * (`RNCNaverMapViewImpl.mm:328`, `RNCNaverMapView.kt:57`), so `mode` here is a
 * mirror of the map rather than a command log. Two things fall out of that for
 * free: panning the map resets the button, and resetting north needs no
 * follow-up call to leave `Face` — the camera move does it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useSharedValue } from 'react-native-reanimated';
import type {
  Camera,
  LocationTrackingMode,
  NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import { logHandledError } from '@/services/crashlytics';

/** Tracking is on in some form — the location dot is drawn. */
export function isTracking(mode: LocationTrackingMode): boolean {
  return mode !== 'None';
}

/** Camera follows the user's heading, so the compass is meaningful. */
export function isFacing(mode: LocationTrackingMode): boolean {
  return mode === 'Face';
}

interface Strings {
  deniedTitle: string;
  deniedBody: string;
  openSettings: string;
  cancel: string;
}

export function useLocationTracking(
  mapRef: React.RefObject<NaverMapViewRef | null>,
  strings: Strings,
) {
  const [mode, setMode] = useState<LocationTrackingMode>('None');

  /**
   * Camera bearing, as a shared value rather than React state.
   * `onCameraChanged` fires continuously through a drag, so state here would
   * re-render this screen — map layers, sheets and all — on every frame of
   * every pan. The only consumer is the compass's rotation, which is a
   * UI-thread style anyway.
   */
  const bearing = useSharedValue(0);

  /**
   * Last camera the map reported.
   *
   * Two readers: `resetNorth`, which needs a position to rotate around, and
   * `moveCamera` on the screen, which needs the current ATTITUDE to decide
   * whether a move can go through the imperative method at all.
   *
   * A ref rather than state, because `onCameraChanged` fires continuously
   * through a drag and re-rendering this screen on every frame of every pan is
   * exactly what the shared value beside it exists to avoid.
   */
  const lastCamera = useRef<Camera | null>(null);

  /** Guards against a second permission prompt while the first is still open. */
  const requesting = useRef(false);

  /**
   * Whether foreground location is granted. `null` until the first check lands.
   *
   * Kept as state, not read on demand, because the map shows a standing offer to
   * turn it on and that offer has to appear without the user pressing anything
   * first. `null` rather than `false` initially so the offer does not flash on
   * every cold start in the moment before the real answer arrives.
   *
   * Re-checked whenever the app returns to the foreground: Settings is the only
   * way back from a permanent denial, and coming back from it is exactly a
   * foreground transition. Without this the offer would linger after the user
   * had already granted the permission.
   */
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      Location.getForegroundPermissionsAsync()
        .then((r) => {
          if (!cancelled) setPermissionGranted(r.granted);
        })
        .catch((e) => logHandledError('useLocationTracking/checkPermission', e));
    };
    check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  /**
   * The `camera` prop, used as a one-shot command channel rather than as
   * controlled state.
   *
   * Resetting the bearing has no imperative route: `NaverMapViewRef` exposes
   * exactly eight methods and not one of them takes a bearing —
   * `animateCameraTo` wants a `Coord` and a zoom. The `camera` PROP does carry
   * it (`RNCNaverMapViewImpl.mm:177-190` reads `bearing` and animates), so the
   * bearing is only reachable that way.
   *
   * Each write stores a fresh object, so React sends the prop and the map
   * animates. Between writes the value is untouched, so it is never re-sent and
   * the imperative `animateCameraTo` call sites on this screen keep working
   * exactly as before — the map is not actually controlled, it just occasionally
   * receives an order. It starts undefined so `initialCamera` still applies on
   * the first render.
   *
   * There are now TWO producers: `resetNorth` here, and `moveCamera` on the
   * screen, which routes a tilted or rotated camera this way because
   * `animateCameraTo` carries neither. The setter is returned as
   * `commandCamera` for that second one. They cannot race — each is a discrete
   * user action, and a later write simply supersedes an earlier one, which is
   * the same thing the SDK would do with two overlapping animations.
   */
  const [cameraCommand, setCameraCommand] = useState<Camera | undefined>(undefined);

  const handleOptionChanged = useCallback(
    (params: { locationTrackingMode: LocationTrackingMode }) => {
      setMode(params.locationTrackingMode);
    },
    [],
  );

  const handleCameraChanged = useCallback(
    (params: Camera) => {
      bearing.value = params.bearing ?? 0;
      lastCamera.current = params;
    },
    [bearing],
  );

  /**
   * Resolves to true only when the SDK may be switched on.
   *
   * `getForegroundPermissionsAsync` first, so an already-granted user never sees
   * a prompt and a permanently-denied one is not asked again by a system dialog
   * that would not appear. `canAskAgain` is what separates "not decided yet"
   * from "denied for good"; only the latter gets sent to Settings.
   */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (requesting.current) return false;
    requesting.current = true;
    try {
      const current = await Location.getForegroundPermissionsAsync();
      setPermissionGranted(current.granted);
      if (current.granted) return true;

      if (current.canAskAgain) {
        const asked = await Location.requestForegroundPermissionsAsync();
        setPermissionGranted(asked.granted);
        // Denied at the prompt just now: no Settings detour, since the user
        // answered the question a second ago and knows what they chose.
        return asked.granted;
      }

      // Permanently denied: the OS will not show a dialog again, so the only
      // route back is Settings. `Linking.openSettings()` directly rather than
      // `lib/openOsSettings`, which routes Android through notifee and lands on
      // the NOTIFICATION page — the wrong destination for a location permission.
      Alert.alert(strings.deniedTitle, strings.deniedBody, [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.openSettings,
          onPress: () => {
            Linking.openSettings().catch((e) =>
              logHandledError('useLocationTracking/openSettings', e),
            );
          },
        },
      ]);
      return false;
    } catch (e) {
      logHandledError('useLocationTracking/ensurePermission', e);
      return false;
    } finally {
      requesting.current = false;
    }
  }, [strings]);

  /**
   * One tap forward through the cycle.
   *
   * Not tracking → `Follow` (move to me and keep up). Following → `Face` (also
   * turn the map to my heading). Facing → back to `Follow`, matching the
   * reference, where the button toggles heading on and off rather than
   * switching tracking off. Turning it off entirely is what panning the map
   * does, via the SDK's own downgrade.
   */
  const cycleMode = useCallback(async (): Promise<boolean> => {
    const next: LocationTrackingMode = mode === 'Follow' ? 'Face' : 'Follow';

    // Re-checked on every activation rather than cached: permission can be
    // revoked in Settings while the app is backgrounded, and switching tracking
    // on without it leaves the map silently showing no dot, which looks like a
    // broken button rather than a denied permission.
    if (mode !== 'Follow' && mode !== 'Face') {
      const ok = await ensurePermission();
      if (!ok) return false;
    }

    mapRef.current?.setLocationTrackingMode(next);
    // Optimistic, then corrected by `onOptionChanged` a moment later. Without
    // it the button would not respond until the native round trip finished,
    // which reads as a dropped tap.
    setMode(next);
    // Reported so the caller can treat the camera settle that follows as the
    // answer to "where am I" rather than as an ordinary pan. A refused
    // permission must not be mistaken for one.
    return true;
  }, [mode, ensurePermission, mapRef]);

  /**
   * Point the map north again.
   *
   * No accompanying `setLocationTrackingMode`: a camera move already drops the
   * SDK out of `Face`, and `onOptionChanged` reports it. Issuing both would race
   * the SDK's own transition.
   */
  const getCurrentCamera = useCallback(() => lastCamera.current, []);

  const resetNorth = useCallback(() => {
    const cam = lastCamera.current;
    // Nothing reported yet means the map has not settled once; there is no
    // position to rotate around, and a command with a zero coordinate would
    // throw the camera into the ocean off West Africa.
    if (!cam) return;
    setCameraCommand({ ...cam, bearing: 0 });
  }, []);

  return {
    mode,
    bearing,
    permissionGranted,
    requestPermission: ensurePermission,
    cameraCommand,
    /**
     * Write the one-shot camera prop directly. The escape hatch for a camera
     * whose tilt or bearing has to change, which no imperative method on
     * `NaverMapViewRef` can do.
     */
    commandCamera: setCameraCommand,
    /**
     * The map's last reported camera, read at call time.
     *
     * A getter rather than the ref or a value, so a caller cannot capture a
     * stale attitude in a memoised callback — the whole point is to ask what the
     * map is doing *now*.
     */
    getCurrentCamera,
    handleOptionChanged,
    handleCameraChanged,
    cycleMode,
    resetNorth,
  };
}
