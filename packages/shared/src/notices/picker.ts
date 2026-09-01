import type { Campus } from '../store/settings';
import type { NoticeTab } from './types';

/**
 * Canonical resolver for a picker tab's effective selected source ids.
 *
 * Priority:
 *   1. `stored` (zustand `pickerSelections[tab.key]`) — filter by validIds
 *      set derived from the current server `picker.sources`.
 *   2. Server `picker.defaultIds` — common defaults filtered by validIds.
 *      Used when the user has not yet confirmed a selection (first install,
 *      zh migration, or any tab where onboarding doesn't prompt).
 *   3. First source — last-resort fallback so the notices tab always
 *      has at least one source id to render; avoids an "empty list" degenerate.
 *
 * Rung 3 is deliberately kept, but it is NOT harmless, and callers should pass
 * `onFallback`. For the `dept` and `general` tabs the server sends no
 * `defaultIds`, so rung 2 is dead and rung 3 is the only other outcome — it
 * renders `sources[0]`, which for `dept` is 'arch' (건축학과, first by Korean
 * collation). That means a save which never landed is displayed as a confident,
 * plausible-looking department the user never chose. Twice now (2026-07 and
 * 2026-09) that has turned a silent write failure into a user-visible bug that
 * nothing reported: the 2026-07 incident ran 84 days because reaching this rung
 * emitted no signal at all. Keeping the rung avoids a blank notices tab for a
 * genuine first-time user; instrumenting it is what makes the broken case
 * visible in Crashlytics rather than only in a support message.
 *
 * Note: campus-conditional defaults (`picker.campusDefaultIds`) are NOT
 * merged here. They're an onboarding-time seed (see `computeOnboardingPickerSeed`)
 * — view-layer fallback uses common defaults only so the displayed selection
 * reflects the user's persisted intent, not a moving target.
 *
 * Used by both `NoticesTabScreen` (picker sheet + list rendering) and
 * `NotificationSettingsScreen` (view-only rows) so that both surfaces show
 * the same effective selection — no divergence where notices shows defaults
 * via fallback but settings renders an empty state.
 */
export function resolvePickerSelection(
  tab: NoticeTab,
  stored: string[] | undefined,
  /**
   * Invoked only when rung 3 is reached AND a source exists to fall back to.
   * Kept as an injected callback rather than an import so this module stays
   * dependency-free and unit-testable.
   */
  onFallback?: () => void,
): string[] {
  if (!tab.picker) return [];
  const picker = tab.picker;
  const validIds = new Set(picker.sources.map((s) => s.id));

  if (stored && stored.length > 0) {
    const valid = stored.filter((id) => validIds.has(id));
    if (valid.length > 0) return valid;
  }

  if (picker.defaultIds.length > 0) {
    return picker.defaultIds.filter((id) => validIds.has(id));
  }

  if (picker.sources.length === 0) return [];
  onFallback?.();
  return [picker.sources[0].id];
}

/**
 * Computes the onboarding seed for a picker tab given the user's selected
 * campus. Merges common defaults with campus-conditional defaults, dedupes,
 * and caps at `maxSelection`.
 *
 * Insertion order: common defaults first, then campus-specific — preserves
 * the SSOT-defined ordering (e.g. lib-all stays at the top of the library
 * picker after seeding).
 *
 * Campus is non-nullable: onboarding flow guards `state.campus` at step 1
 * (OnboardingScreen.tsx) so handleComplete never reaches here with null.
 *
 * Returns [] for fixed tabs — caller can pass any tab without pre-filtering.
 */
export function computeOnboardingPickerSeed(
  tab: NoticeTab,
  campus: Campus,
): string[] {
  if (tab.tabMode !== 'picker' || !tab.picker) return [];
  const picker = tab.picker;
  const validIds = new Set(picker.sources.map((s) => s.id));

  const common = picker.defaultIds.filter((id) => validIds.has(id));
  const campusAdds = (picker.campusDefaultIds[campus] ?? []).filter((id) =>
    validIds.has(id),
  );

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...common, ...campusAdds]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged.slice(0, picker.maxSelection);
}
