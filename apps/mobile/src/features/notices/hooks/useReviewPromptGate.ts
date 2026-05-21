import { useCallback } from 'react';
import { useEngagementStore, type EngagementState } from '@skkuverse/shared';
import { logReviewPromptShown } from '@/services/analytics';

/**
 * Review-prompt gate — encodes the 5-axis trigger policy:
 *
 *   1. delightedBookmarkCount >= 2  (single delight could be coincidence)
 *   2. firstLaunchAt + 7d <= now    (skip onboarding fatigue window)
 *   3. lastReviewPromptAt + 90d <= now OR never  (respect cooldown)
 *   4. reviewPromptOutcome !== 'positive'   (don't re-ask happy users)
 *   5. firstLaunchAt initialized            (set by useAppInit on boot)
 *
 * iOS SKStoreReviewController has a hard 365d/3-prompt quota; 90d cooldown
 * keeps us inside the math (~4 chances/year worst case, but we'll spend
 * fewer in practice because positive-outcome cuts off future asks).
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const DELIGHT_COUNT_THRESHOLD = 2;

export function shouldShowReviewPrompt(
  state: Pick<
    EngagementState,
    | 'firstLaunchAt'
    | 'delightedBookmarkCount'
    | 'lastReviewPromptAt'
    | 'reviewPromptOutcome'
  >,
  now: number,
): boolean {
  if (state.firstLaunchAt === 0) return false;
  if (state.delightedBookmarkCount < DELIGHT_COUNT_THRESHOLD) return false;
  if (now - state.firstLaunchAt < SEVEN_DAYS_MS) return false;
  if (
    state.lastReviewPromptAt !== null &&
    now - state.lastReviewPromptAt < NINETY_DAYS_MS
  ) {
    return false;
  }
  if (state.reviewPromptOutcome === 'positive') return false;
  return true;
}

/**
 * Imperative trigger — call after a delight signal (push + AI summary +
 * bookmark). Pass a callback that opens the stage 1 sheet; we'll invoke it
 * only if all conditions pass. Internally:
 *   1. records the delight (counter++)
 *   2. checks the gate against the NEW counter value
 *   3. if pass: marks lastPromptAt + logs analytics + opens sheet
 *
 * Reason string flows into analytics — keep stable across versions for
 * funnel readability.
 */
export function useReviewPromptGate() {
  return useCallback(
    (reason: string, openSheet: () => void) => {
      const store = useEngagementStore.getState();
      store.recordDelightedBookmark();
      const after = useEngagementStore.getState();
      if (!shouldShowReviewPrompt(after, Date.now())) return;
      store.markPromptShown();
      logReviewPromptShown({ reason, count: after.delightedBookmarkCount });
      openSheet();
    },
    [],
  );
}
