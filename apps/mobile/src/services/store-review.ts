import * as StoreReview from 'expo-store-review';
import { logHandledError } from '@/services/crashlytics';
import { logReviewNativeCalled } from '@/services/analytics';

/**
 * Thin wrapper around expo-store-review.
 *
 * `StoreReview.requestReview()` resolves the underlying native call (iOS
 * `SKStoreReviewController.requestReview` / Android Play Core In-App
 * Review). On iOS, the OS enforces a hard quota — at most 3 prompts per
 * app per 365-day rolling window per user — and silently skips when
 * exceeded. There is NO JS-visible signal for "skipped vs shown". Same on
 * TestFlight (always silent) and iOS Simulator (sometimes silent).
 *
 * Therefore: the analytics event we fire here means "we asked the OS to
 * show it", not "the user saw it". Treat funnel arithmetic accordingly.
 */
export async function requestNativeReview(reason: string): Promise<void> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      // Some Android devices without Play Services land here. No fallback —
      // we choose silence over routing to a web rating page (which adds
      // friction and dilutes positive intent). We DO emit a telemetry
      // event with available: false so the funnel can attribute drop-off
      // here vs. iOS-quota silence vs. user-initiated bail.
      logReviewNativeCalled({ reason, available: false });
      return;
    }
    logReviewNativeCalled({ reason, available: true });
    await StoreReview.requestReview();
  } catch (e) {
    // Never bubble — review prompt failure should not crash the screen the
    // user is happily using. Log to Crashlytics for visibility.
    logHandledError('store-review/request-failed', e);
  }
}
