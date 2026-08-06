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

/**
 * Per-surface cooldown record. Key = reason string (e.g. 'second_bookmark').
 * Drives independent 90-day cooldown so declining on one surface does not
 * suppress prompts on another surface.
 */
export interface ReviewPromptHistoryEntry {
  lastShownAt: number;
  /** null when outcome was positive (tracked globally) or prompt never resolved. */
  lastOutcome: 'negative' | 'dismissed' | null;
}

export interface EngagementState {
  /**
   * Wall-clock ms timestamp of the first time `init()` ran on this install.
   * Initialized once by useAppInit; never updated thereafter.
   * 0 sentinel = uninitialized.
   */
  firstLaunchAt: number;
  /**
   * Global kill-switch. Set to true when ANY surface receives a 'positive'
   * outcome. Once true, no surface ever shows the review prompt again.
   */
  hasGivenPositiveReview: boolean;
  /**
   * Per-surface history keyed by reason. Drives independent 90-day cooldown
   * per surface. Positive outcomes are NOT stored here — they're tracked via
   * the global `hasGivenPositiveReview` flag instead.
   */
  reviewPromptHistory: Record<string, ReviewPromptHistoryEntry>;
  /**
   * Cumulative mount count of app/bus/schedule.tsx. Used to gate the shuttle
   * review prompt after 3+ visits.
   */
  injaShuttleVisitCount: number;
  /**
   * Session-only armed flag. Set on schedule screen mount, consumed when
   * transit tab regains focus. Distinguishes "came back from shuttle" from
   * an unrelated tab switch that also fires useFocusEffect. Not persisted.
   */
  shuttlePromptArmed: boolean;
}

interface EngagementActions {
  /** One-shot first-launch stamp. No-op if already set. */
  initFirstLaunchIfNeeded: () => void;
  /** Mark that the review prompt was shown for a given surface (starts cooldown). */
  markPromptShown: (reason: string) => void;
  /**
   * Record the user's outcome for a given prompt surface.
   * 'positive' → sets global kill-switch.
   * 'negative' | 'dismissed' → records per-surface cooldown entry.
   */
  setOutcome: (reason: string, outcome: ReviewPromptOutcome) => void;
  /** Increment the schedule visit count and arm the shuttle prompt trigger. */
  incrementInjaShuttleVisit: () => void;
  /** Consume the armed flag (prevents re-trigger on unrelated tab focuses). */
  consumeShuttleArm: () => void;
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
      hasGivenPositiveReview: false,
      reviewPromptHistory: {},
      injaShuttleVisitCount: 0,
      shuttlePromptArmed: false,

      initFirstLaunchIfNeeded: () => {
        if (get().firstLaunchAt === 0) {
          set({ firstLaunchAt: Date.now() });
        }
      },

      markPromptShown: (reason) =>
        set((s) => ({
          reviewPromptHistory: {
            ...s.reviewPromptHistory,
            [reason]: {
              lastShownAt: Date.now(),
              lastOutcome: s.reviewPromptHistory[reason]?.lastOutcome ?? null,
            },
          },
        })),

      setOutcome: (reason, outcome) => {
        if (outcome === 'positive') {
          // Global kill-switch: positive on any surface suppresses all surfaces.
          set({ hasGivenPositiveReview: true });
        } else {
          set((s) => ({
            reviewPromptHistory: {
              ...s.reviewPromptHistory,
              [reason]: {
                lastShownAt: s.reviewPromptHistory[reason]?.lastShownAt ?? Date.now(),
                lastOutcome: outcome,
              },
            },
          }));
        }
      },

      incrementInjaShuttleVisit: () =>
        set((s) => ({
          injaShuttleVisitCount: s.injaShuttleVisitCount + 1,
          shuttlePromptArmed: true,
        })),

      consumeShuttleArm: () => set({ shuttlePromptArmed: false }),
    }),
    {
      name: 'engagement',
      version: 3,
      // v1→v2 dropped delightedBookmarkCount (trigger now reads live bookmark count).
      // v2→v3 unified per-surface history and added global positive kill-switch:
      //   - hasGivenPositiveReview = (old.reviewPromptOutcome === 'positive')
      //   - lastReviewPromptAt → reviewPromptHistory['second_bookmark'].lastShownAt
      //   - old single reviewPromptOutcome → per-surface lastOutcome
      //   - new fields: injaShuttleVisitCount, shuttlePromptArmed (session-only)
      migrate: (persisted, version) => {
        const next = { ...(persisted as Record<string, unknown>) };

        // v1 → remove stale counter
        if (version < 2) {
          delete next.delightedBookmarkCount;
        }

        // v2 → per-surface history + global positive flag
        if (version < 3) {
          type OldOutcome = 'positive' | 'negative' | 'dismissed' | null | undefined;
          const oldOutcome = next.reviewPromptOutcome as OldOutcome;
          const oldLastShownAt = next.lastReviewPromptAt as number | null | undefined;

          next.hasGivenPositiveReview = oldOutcome === 'positive';

          const history: Record<string, ReviewPromptHistoryEntry> = {};
          if (oldLastShownAt != null) {
            history['second_bookmark'] = {
              lastShownAt: oldLastShownAt,
              lastOutcome:
                oldOutcome === 'positive' || oldOutcome == null ? null : oldOutcome,
            };
          }
          next.reviewPromptHistory = history;
          next.injaShuttleVisitCount = 0;
          next.shuttlePromptArmed = false;

          delete next.reviewPromptOutcome;
          delete next.lastReviewPromptAt;
        }

        return next as unknown as EngagementStore;
      },
      // shuttlePromptArmed is session-only — not written to MMKV.
      partialize: (state) => ({
        firstLaunchAt: state.firstLaunchAt,
        hasGivenPositiveReview: state.hasGivenPositiveReview,
        reviewPromptHistory: state.reviewPromptHistory,
        injaShuttleVisitCount: state.injaShuttleVisitCount,
      }),
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);
