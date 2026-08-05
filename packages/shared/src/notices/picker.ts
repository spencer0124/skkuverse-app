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

  return picker.sources.length > 0 ? [picker.sources[0].id] : [];
}

/**
 * Hard-coded mirror of `NoticesController.MAX_MULTI_SOURCE_IDS` in
 * skkuverse-server (`src/notices/notices.controller.ts`). `GET /notices`
 * rejects more ids than this with `400 INVALID_PARAMS` — there is no way to
 * discover the value at runtime, so it has to be duplicated here.
 *
 * Today the ceiling is exactly met: 5 fixed tabs + dept(5) + library(3) +
 * dorm(2) + general(5) = 20. **Adding a notice tab, or raising any picker's
 * `maxSelection`, pushes the "전체" scope past the contract.** Callers must
 * treat a union larger than this as "전체 unavailable" rather than sending the
 * request — see `NoticesSearchScreen`. Raise the server constant first, then
 * this one.
 */
export const NOTICE_MULTI_SOURCE_LIMIT = 20;

/**
 * Union of every source the user is currently following: each fixed tab's
 * `sourceId` plus each picker tab's *effective* selection (so a tab the user
 * never touched still contributes its server defaults, exactly as the tab
 * itself would render).
 *
 * This is the client-side definition of the search screen's "전체" scope. It
 * deliberately means "everything I follow", NOT "every source that exists" —
 * the latter would need a server-side scope parameter and would drag in
 * hundreds of unselected department sources.
 *
 * Sorted + deduped: `useMultiSourceNoticeList` builds its React Query cache
 * key from `sourceIds.slice().sort().join(',')`, so returning a stable order
 * here keeps the key stable across tab-config refetches that reorder tabs.
 */
export function resolveAllFollowedSourceIds(
  tabs: NoticeTab[],
  pickerSelections: Record<string, string[] | undefined>,
): string[] {
  const ids = new Set<string>();
  for (const tab of tabs) {
    if (tab.tabMode === 'picker' && tab.picker) {
      for (const id of resolvePickerSelection(tab, pickerSelections[tab.key])) {
        ids.add(id);
      }
    } else if (tab.tabMode === 'fixed' && tab.fixed) {
      ids.add(tab.fixed.sourceId);
    }
  }
  return Array.from(ids).sort();
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
