import type { NoticeTab } from './types';

/**
 * Canonical resolver for a picker tab's effective selected dept ids.
 *
 * Priority:
 *   1. `stored` (zustand `pickerSelections[tab.key]`) — filter by validIds
 *      set derived from the current server `picker.departments`.
 *   2. Server `picker.defaultDeptIds` — filtered by validIds. Used when the
 *      user has not yet confirmed a selection (first install, zh migration,
 *      or library tab where onboarding doesn't prompt).
 *   3. First department — last-resort fallback so the notices tab always
 *      has at least one deptId to render; avoids an "empty list" degenerate.
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
  const validIds = new Set(picker.departments.map((d) => d.id));

  if (stored && stored.length > 0) {
    const valid = stored.filter((id) => validIds.has(id));
    if (valid.length > 0) return valid;
  }

  if (picker.defaultDeptIds.length > 0) {
    return picker.defaultDeptIds.filter((id) => validIds.has(id));
  }

  return picker.departments.length > 0 ? [picker.departments[0].id] : [];
}
