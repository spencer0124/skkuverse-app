/**
 * Context-aware filtering for picker `TabSource[]`.
 *
 * The same dept list is reused across surfaces but should not look the same:
 *
 * - **Onboarding (step 2/3)** — `showUnsupported: true`. Unsupported entries
 *   stay in the list (rendered greyed out) so the user can tap one and learn
 *   *why* it's not supported, with a parent-college alternative offered.
 *
 * - **Main NoticePickerSheet** — `showUnsupported: false`. The user has
 *   already onboarded; unsupported entries here are noise during a
 *   subscription change.
 *
 * The filter is intentionally a thin selector with no React Query / store
 * coupling — call it where you produce the list for the renderer.
 */

import type { TabSource } from './types';

export interface FilterPickerSourcesOptions {
  /**
   * When true, entries with `noticeAvailable === false` are kept (the caller
   * is expected to render them with a disabled style and tap-to-explain
   * affordance). When false, they are removed entirely.
   */
  showUnsupported: boolean;
}

export function filterPickerSources(
  sources: readonly TabSource[],
  opts: FilterPickerSourcesOptions,
): TabSource[] {
  if (opts.showUnsupported) return [...sources];
  return sources.filter((s) => s.noticeAvailable);
}

/**
 * Convenience predicate: a source is unsupported when the server marked it
 * as such with a reason. Matches the `noticeAvailable ⇔ excludeReason==null`
 * biconditional invariant — either side answers the same question, but
 * checking both makes intent obvious at the call site.
 */
export function isUnsupportedSource(source: TabSource): boolean {
  return !source.noticeAvailable && source.excludeReason !== null;
}
