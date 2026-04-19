import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Crashlytics initialization — mirrors Flutter's initFirebase() error handling.
 *
 * The @react-native-firebase/crashlytics module automatically installs a global
 * JS exception handler (via ErrorUtils internally). We do NOT set up ErrorUtils
 * manually — that would cause duplicate crash reports.
 *
 * What we handle here:
 * - React ErrorBoundary errors (caught errors don't reach the global handler)
 * - User identity for crash reports
 *
 * Dev/prod collection is controlled via firebase.json:
 *   crashlytics_auto_collection_enabled: true
 *   crashlytics_debug_enabled: false
 *
 * Flutter source: lib/main.dart (initFirebase)
 */

/** Report error from React ErrorBoundary (equivalent to FlutterError.onError) */
export function recordError(error: Error, componentStack?: string | null) {
  if (__DEV__) return;
  if (componentStack) {
    crashlytics().log(componentStack);
  }
  crashlytics().recordError(error, 'ReactErrorBoundary');
}

/** Set user identifier for crash reports */
export function setCrashlyticsUserId(uid: string) {
  if (__DEV__) return;
  crashlytics().setUserId(uid).catch(() => {});
}

/**
 * Report a handled error with a semantic label (e.g. 'notifications/init').
 * Unlike `recordError`, this is for non-fatal paths — Firestore bootstrap
 * failures, optional retry exhaustion, etc. — where the app should continue
 * running but Crashlytics should know the degradation happened.
 */
export function logHandledError(label: string, error: unknown) {
  if (__DEV__) {
    console.warn(`[crashlytics] ${label}:`, error);
    return;
  }
  try {
    crashlytics().log(label);
    const err = error instanceof Error ? error : new Error(String(error));
    crashlytics().recordError(err, label);
  } catch {
    // never throw from logging
  }
}
