import firestore from '@react-native-firebase/firestore';
import appCheck from '@react-native-firebase/app-check';
import { authStore } from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';

/**
 * Firestore feedback collection — user-submitted negative-side feedback from
 * the review-prompt stage 2b sheet. Path: `users/{uid}/feedback/{autoId}`.
 *
 * Why a per-user subcollection (vs. anonymous top-level):
 *   - We need ownership-based Rules (only the user can read their feedback).
 *   - Anonymous would force a separate "deletion" flow on account deletion;
 *     subcollection inherits the user document's deletion cascade.
 *
 * Why mirror firestore-bookmarks.ts pattern (primeAppCheck before write):
 *   On iOS Simulator + sometimes on Android, App Check tokens can become
 *   stale between writes. Forcing a refresh costs ~50ms but eliminates the
 *   PERMISSION_DENIED from server while local cache happily accepts.
 */

export type FeedbackContext = 'ai_summary_helpful_sheet';

export interface FeedbackSubmission {
  context: FeedbackContext;
  text: string;
  /** Optional notice the user was looking at when they gave feedback. */
  noticeRef?: { sourceId: string; articleNo: number };
}

async function primeAppCheck(): Promise<void> {
  try {
    await appCheck().getToken(true);
  } catch (e) {
    logHandledError('feedback/app-check-refresh', e);
  }
}

/**
 * Submit a piece of feedback. Returns true on success, false on permanent
 * failure (auth missing, etc.). Network errors are absorbed by the SDK's
 * offline queue and surface as `true` — same philosophy as bookmark saves.
 *
 * Caller pattern: show a "감사합니다" toast on `true`, a "다시 시도" on `false`.
 */
export async function submitNegativeFeedback(
  payload: FeedbackSubmission,
): Promise<boolean> {
  const auth = authStore.getState();
  if (auth.isAnonymous || !auth.uid) return false;

  await primeAppCheck();

  try {
    await firestore()
      .collection('users')
      .doc(auth.uid)
      .collection('feedback')
      .add({
        context: payload.context,
        text: payload.text.slice(0, 2000),
        ...(payload.noticeRef && {
          sourceId: payload.noticeRef.sourceId,
          articleNo: payload.noticeRef.articleNo,
        }),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    return true;
  } catch (e) {
    logHandledError('feedback/submit-failed', e);
    return false;
  }
}
