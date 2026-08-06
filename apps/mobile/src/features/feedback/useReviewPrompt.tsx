import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Dialog, Toast } from '@skkuverse/sds';
import { useEngagementStore, useT } from '@skkuverse/shared';
import { ReviewPromptSheet } from './ReviewPromptSheet';
import { NegativeFeedbackSheet } from './NegativeFeedbackSheet';
import { submitNegativeFeedback } from '@/services/feedback';
import { requestNativeReview } from '@/services/store-review';
import {
  logReviewPromptDismissed,
  logReviewPromptNegative,
  logReviewPromptPositive,
  logReviewPromptShown,
} from '@/services/analytics';
import { shouldShowReviewPrompt, DEV_ALWAYS_SHOW } from './useReviewPromptGate';

/**
 * Configuration for a single review-prompt surface (e.g. bookmark, shuttle).
 */
export interface UseReviewPromptOptions {
  /**
   * Stable string identifying this surface. Used as:
   *   - analytics `reason` param  (keep consistent across versions)
   *   - engagement store key for per-surface cooldown history
   *   - feedback document `source` field for server-side analytics
   */
  reason: string;
  /**
   * Minimum time since first launch before this surface can show the prompt.
   * Use THREE_DAYS_MS for notices, SEVEN_DAYS_MS for shuttle.
   */
  minInstallAgeMs: number;
  /** Surface-specific title rendered in the review-prompt sheet. */
  title: string;
  /** Surface-specific icon rendered in the green circle of the sheet. */
  icon: ReactNode;
  /**
   * Optional context resolver for notice surfaces. Called at submission time
   * to attach noticeRef to the feedback document.
   */
  resolveContext?: () => { sourceId: string; articleNo: number };
}

export interface UseReviewPromptReturn {
  /**
   * Call after the caller's own eligibility pre-check passes. Internally
   * applies the install-age + cooldown + global-positive gate before
   * presenting the review sheet. In `__DEV__` builds all gate conditions
   * are bypassed so the sheet is easy to QA.
   *
   * @param count - Trigger count forwarded to `review_prompt_shown` analytics
   *   (bookmark count for notices, visit count for shuttle).
   */
  triggerIfEligible: (count: number) => void;
  /**
   * Render this in the JSX tree of the host screen (directly, not wrapped).
   * Contains the stage-1 sheet, stage-2 feedback sheet, thanks dialog, and
   * retry toast — all scoped to this surface's reason.
   */
  Host: ReactNode;
}

/**
 * Orchestrates the full review-prompt funnel for one surface:
 *   stage 1: ReviewPromptSheet (👍/👎)
 *   stage 2a: native StoreReview on 👍
 *   stage 2b: NegativeFeedbackSheet on 👎
 *
 * Gate logic, analytics, Firestore write, and engagement-store updates are
 * all contained here. Callers only need to call `triggerIfEligible(count)`
 * after their own threshold check and render `{review.Host}` in their JSX.
 *
 * Analytics are scoped by `reason` param so multiple surfaces are fully
 * distinguishable in BigQuery without additional instrumentation.
 *
 * Suppression model:
 *   - Positive (👍) anywhere → `hasGivenPositiveReview = true` → global
 *     kill-switch blocks ALL surfaces permanently.
 *   - Negative / dismissed → per-surface 90-day cooldown via
 *     `reviewPromptHistory[reason]`. One surface declining does NOT suppress
 *     the other.
 */
export function useReviewPrompt({
  reason,
  minInstallAgeMs,
  title,
  icon,
  resolveContext,
}: UseReviewPromptOptions): UseReviewPromptReturn {
  const { t } = useT();
  const helpfulSheetRef = useRef<BottomSheetModal>(null);
  const feedbackSheetRef = useRef<BottomSheetModal>(null);

  // Tracks whether the user made an explicit choice (👍 or 👎) on the stage-1
  // sheet. BottomSheetModal fires `onDismiss` for BOTH swipe-close AND
  // programmatic dismiss-after-choice, so we use this ref to avoid
  // double-recording the outcome as 'dismissed' when a choice was already made.
  const explicitOutcomeRef = useRef<'positive' | 'negative' | null>(null);

  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const setOutcome = useEngagementStore((s) => s.setOutcome);
  const markPromptShown = useEngagementStore((s) => s.markPromptShown);

  // ── triggerIfEligible ────────────────────────────────────────────────────

  const triggerIfEligible = useCallback(
    (count: number) => {
      const store = useEngagementStore.getState();
      if (!DEV_ALWAYS_SHOW && !shouldShowReviewPrompt(store, reason, Date.now(), minInstallAgeMs)) {
        return;
      }
      markPromptShown(reason);
      logReviewPromptShown({ reason, count });
      explicitOutcomeRef.current = null;
      helpfulSheetRef.current?.present();
    },
    [reason, minInstallAgeMs, markPromptShown],
  );

  // ── Stage-1 handlers (ReviewPromptSheet) ────────────────────────────────

  const handlePositive = useCallback(() => {
    explicitOutcomeRef.current = 'positive';
    setOutcome(reason, 'positive');
    logReviewPromptPositive({ reason });
    void requestNativeReview(reason);
  }, [reason, setOutcome]);

  const handleNegative = useCallback(() => {
    explicitOutcomeRef.current = 'negative';
    // Do NOT record 'negative' outcome yet — wait for stage-2 submit/dismiss
    // so the funnel can distinguish "👎 then submitted text" from "👎 then bailed".
    feedbackSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    // No explicit choice was made — user swiped or tapped backdrop.
    if (explicitOutcomeRef.current !== null) return; // already handled
    setOutcome(reason, 'dismissed');
    logReviewPromptDismissed({ reason });
  }, [reason, setOutcome]);

  // ── Stage-2 handlers (NegativeFeedbackSheet) ────────────────────────────

  const handleFeedbackSubmit = useCallback(
    (text: string) => {
      setIsFeedbackSubmitting(true);
      const context = resolveContext?.();
      void submitNegativeFeedback({
        source: reason,
        text,
        noticeRef: context,
      })
        .then((success) => {
          if (!success) {
            // Keep sheet open so user can retry. Do NOT record outcome here
            // so the funnel preserves stage-1 intent without inflating the
            // submit count with events that never wrote a doc.
            setToastText(t('feedback.reviewPrompt.retry'));
            return;
          }
          setOutcome(reason, 'negative');
          logReviewPromptNegative({ reason, hasText: text.length > 0 });
          feedbackSheetRef.current?.dismiss();
          setShowThanks(true);
        })
        .finally(() => setIsFeedbackSubmitting(false));
    },
    [reason, resolveContext, setOutcome, t],
  );

  const handleFeedbackDismiss = useCallback(() => {
    // Negative path final outcome: regardless of submit-vs-bail, if outcome
    // wasn't already set by a successful submit, record 'negative' here so
    // the 90d per-surface cooldown applies.
    const history = useEngagementStore.getState().reviewPromptHistory[reason];
    if (history?.lastOutcome == null) {
      setOutcome(reason, 'negative');
      logReviewPromptNegative({ reason, hasText: false });
    }
  }, [reason, setOutcome]);

  // ── Host JSX ────────────────────────────────────────────────────────────

  const Host = (
    <>
      <ReviewPromptSheet
        ref={helpfulSheetRef}
        icon={icon}
        title={title}
        onPositive={handlePositive}
        onNegative={handleNegative}
        onDismiss={handleDismiss}
      />
      <NegativeFeedbackSheet
        ref={feedbackSheetRef}
        isSubmitting={isFeedbackSubmitting}
        onSubmit={handleFeedbackSubmit}
        onDismiss={handleFeedbackDismiss}
      />
      <Dialog.Alert
        open={showThanks}
        title={t('feedback.reviewPrompt.thanks')}
        buttonText={t('common.close')}
        onClose={() => setShowThanks(false)}
      />
      <Toast
        open={toastText !== null}
        text={toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={() => setToastText(null)}
      />
    </>
  );

  return { triggerIfEligible, Host };
}
