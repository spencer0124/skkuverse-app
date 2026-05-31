import firestore from '@react-native-firebase/firestore';
import appCheck from '@react-native-firebase/app-check';
import { authStore } from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';

/**
 * Firestore feedback — review-prompt 아쉬워요 feedback written to the unified
 * top-level `feedback/{autoId}` collection with `type: 'review_prompt'`. Shares
 * the collection with account-deletion feedback (written server-side by the
 * deleteAccount CF with `type: 'account_deletion'`).
 *
 * Anonymous by design — no uid is stored (Rules + the account-deletion side are
 * both uid-less; see firestore.rules `feedback/{docId}`). The client is still
 * gated to signed-in users, but the document carries no identity.
 *
 * Why mirror firestore-bookmarks.ts pattern (primeAppCheck before write):
 *   On iOS Simulator + sometimes on Android, App Check tokens can become
 *   stale between writes. Forcing a refresh costs ~50ms but eliminates the
 *   PERMISSION_DENIED from server while local cache happily accepts.
 */

export interface FeedbackSubmission {
  text: string;
  /**
   * Surface identifier — matches the `reason` string passed to useReviewPrompt.
   * Written to the `feedback` document so server-side analytics can distinguish
   * feedback surfaces (e.g. 'second_bookmark' vs 'inja_shuttle').
   */
  source: string;
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
      .collection('feedback')
      .add({
        type: 'review_prompt',
        source: payload.source,
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
