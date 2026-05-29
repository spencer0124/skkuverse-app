import { useCallback } from 'react';
import { useEngagementStore, type EngagementState } from '@skkuverse/shared';
import { logReviewPromptShown } from '@/services/analytics';

/**
 * Review-prompt gate — encodes the time/outcome trigger policy:
 *
 *   1. firstLaunchAt initialized            (set by useAppInit on boot)
 *   2. firstLaunchAt + 3d <= now            (skip onboarding fatigue window)
 *   3. lastReviewPromptAt + 90d <= now OR never  (respect cooldown)
 *   4. reviewPromptOutcome !== 'positive'   (don't re-ask happy users)
 *
 * The "2nd+ bookmark" eligibility is checked at the call site (useBookmark) —
 * this gate owns only the time/outcome throttling. iOS SKStoreReviewController
 * has a hard 365d/3-prompt quota; the 90d cooldown keeps us inside the math,
 * and the positive-outcome cutoff spends fewer in practice.
 */

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * In dev builds, show the review prompt on EVERY bookmark save, bypassing the
 * 2nd-bookmark threshold AND the time/outcome gate — makes the sheet trivial
 * to QA. `__DEV__` is false in TestFlight/production, so shipped builds always
 * use the real gate. Nothing to revert before shipping.
 */
export const DEV_ALWAYS_SHOW = __DEV__;

export function shouldShowReviewPrompt(
  state: Pick<
    EngagementState,
    'firstLaunchAt' | 'lastReviewPromptAt' | 'reviewPromptOutcome'
  >,
  now: number,
): boolean {
  if (state.firstLaunchAt === 0) return false;
  if (now - state.firstLaunchAt < THREE_DAYS_MS) return false;
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
 * Imperative trigger — call after the 2nd+ bookmark save. Pass the current
 * bookmark count (for funnel analytics) and a callback that opens the prompt
 * sheet; we invoke it only if all gate conditions pass. On pass:
 *   1. marks lastReviewPromptAt (starts the 90-day cooldown)
 *   2. logs analytics
 *   3. opens the sheet
 *
 * Reason string flows into analytics — keep stable across versions for
 * funnel readability.
 */
export function useReviewPromptGate() {
  return useCallback(
    (reason: string, count: number, openSheet: () => void) => {
      const store = useEngagementStore.getState();
      if (!DEV_ALWAYS_SHOW && !shouldShowReviewPrompt(store, Date.now())) return;
      store.markPromptShown();
      logReviewPromptShown({ reason, count });
      openSheet();
    },
    [],
  );
}
