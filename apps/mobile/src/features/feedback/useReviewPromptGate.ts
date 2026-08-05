import { type EngagementState } from '@skkuverse/shared';

/**
 * Review-prompt gate — encodes the time/outcome trigger policy.
 *
 * Conditions (all must pass):
 *   1. firstLaunchAt initialized            (set by useAppInit on boot)
 *   2. firstLaunchAt + minInstallAgeMs <= now
 *   3. hasGivenPositiveReview === false      (global kill-switch)
 *   4. lastShownAt + 90d <= now OR never    (per-surface cooldown)
 *
 * The eligibility pre-check (e.g. "2nd+ bookmark", "3+ shuttle visits") is
 * handled at each call site — this gate owns only the time/outcome throttling.
 *
 * iOS SKStoreReviewController has a hard 365d/3-prompt quota; the 90d
 * cooldown keeps us well inside the math. The positive-outcome global
 * kill-switch spends fewer quota slots in practice.
 */

export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * In dev builds, bypass ALL gate conditions — install age, cooldown, and the
 * caller's eligibility threshold. Makes the sheet trivial to QA on every
 * trigger. `__DEV__` is false in TestFlight/production so shipped builds
 * always use the real gate. Nothing to revert before shipping.
 */
export const DEV_ALWAYS_SHOW = __DEV__;

export function shouldShowReviewPrompt(
  state: Pick<
    EngagementState,
    'firstLaunchAt' | 'hasGivenPositiveReview' | 'reviewPromptHistory'
  >,
  reason: string,
  now: number,
  minInstallAgeMs: number = THREE_DAYS_MS,
): boolean {
  if (state.firstLaunchAt === 0) return false;
  if (now - state.firstLaunchAt < minInstallAgeMs) return false;
  if (state.hasGivenPositiveReview) return false;
  const h = state.reviewPromptHistory[reason];
  if (h?.lastShownAt != null && now - h.lastShownAt < NINETY_DAYS_MS) return false;
  return true;
}
