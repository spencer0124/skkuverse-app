import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';

/**
 * Outcome of the in-app review prompt (stage 1 sheet) — separate from the
 * native StoreReview prompt because iOS quota makes the native result
 * unobservable from JS. We track what the user clicked in OUR sheet:
 *   - 'positive' → 👍 tapped, native prompt invoked (may or may not show)
 *   - 'negative' → 👎 tapped, routed to feedback collection instead
 *   - 'dismissed' → swipe-to-close or explicit dismiss without choosing
 */
export type ReviewPromptOutcome = 'positive' | 'negative' | 'dismissed';

export interface EngagementState {
  /**
   * Wall-clock ms timestamp of the first time `init()` ran on this install.
   * Initialized once by useAppInit; never updated thereafter. Used by the
   * review-prompt gate to enforce a 7-day grace period after install.
   * 0 sentinel = uninitialized.
   */
  firstLaunchAt: number;
  /**
   * Count of "delight moments" — user opened a notice via push tap, the
   * notice had an AI summary, and the user bookmarked it. We require 2
   * before showing the review sheet (1 is coincidence, 2 is a pattern).
   */
  delightedBookmarkCount: number;
  /**
   * Wall-clock ms of last time the stage 1 sheet was shown. Used for the
   * 90-day cooldown. null = never shown.
   */
  lastReviewPromptAt: number | null;
  reviewPromptOutcome: ReviewPromptOutcome | null;
}

interface EngagementActions {
  /** One-shot first-launch stamp. No-op if already set. */
  initFirstLaunchIfNeeded: () => void;
  recordDelightedBookmark: () => void;
  markPromptShown: () => void;
  setOutcome: (outcome: ReviewPromptOutcome) => void;
}

export type EngagementStore = EngagementState & EngagementActions;

/**
 * Engagement signals — separate from settings store on purpose:
 *   - settings.ts persists user *preferences* (campus, language, picker picks)
 *   - engagement.ts persists derived runtime *signals* (counters, timestamps)
 *
 * Splitting them keeps settings.ts version-stable (every settings schema
 * change forces a `migrate` branch) while engagement can iterate freely.
 *
 * MMKV-backed via Zustand persist. Synchronous hydration — no loading state.
 */
export const useEngagementStore = create<EngagementStore>()(
  persist(
    (set, get) => ({
      firstLaunchAt: 0,
      delightedBookmarkCount: 0,
      lastReviewPromptAt: null,
      reviewPromptOutcome: null,

      initFirstLaunchIfNeeded: () => {
        if (get().firstLaunchAt === 0) {
          set({ firstLaunchAt: Date.now() });
        }
      },
      recordDelightedBookmark: () =>
        set((s) => ({ delightedBookmarkCount: s.delightedBookmarkCount + 1 })),
      markPromptShown: () => set({ lastReviewPromptAt: Date.now() }),
      setOutcome: (outcome) => set({ reviewPromptOutcome: outcome }),
    }),
    {
      name: 'engagement',
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);
