import type { TabSource } from './types';

export interface CollegeMates {
  /** Sources that share the primary's college (excluding the primary itself). */
  recommended: TabSource[];
  /** Everything else, in original order. */
  others: TabSource[];
}

/**
 * Splits a `TabSource[]` into "same-college mates" and "everything else"
 * relative to a chosen primary department. Used by the interest-dept step to
 * surface a "같은 단과대학" section above the rest of the list.
 *
 * - `null` primary or `null` college on the primary → all sources go to
 *   `others`, `recommended` is empty.
 * - Order within each bucket follows the original source order.
 */
export function recommendCollegeMates(
  primary: TabSource | null,
  all: readonly TabSource[],
): CollegeMates {
  if (!primary || primary.college == null) {
    return { recommended: [], others: [...all] };
  }
  const recommended: TabSource[] = [];
  const others: TabSource[] = [];
  for (const source of all) {
    if (source.id === primary.id) continue; // primary is shown separately
    if (source.college != null && source.college === primary.college) {
      recommended.push(source);
    } else {
      others.push(source);
    }
  }
  return { recommended, others };
}

/**
 * Finds the "umbrella" entry of the same college — the source that represents
 * the college itself (not a specific department). Heuristic:
 *
 * 1. Same college as the primary, but a different id.
 * 2. The umbrella's `name` contains the college name as a substring (e.g.
 *    "소프트웨어융합대학(학부생)" contains "소프트웨어융합대학"). This filters
 *    out sibling departments whose name doesn't start with the college.
 * 3. Must be `noticeAvailable` itself — we never propose an unsupported
 *    alternative to an unsupported source.
 *
 * Returns the first match, or null if none exists. Used when a user taps an
 * unsupported dept on step 2 to offer the parent college as an alternative.
 */
export function findCollegeUmbrella(
  primary: TabSource,
  all: readonly TabSource[],
): TabSource | null {
  if (primary.college == null) return null;
  const college = primary.college;
  return (
    all.find(
      (s) =>
        s.id !== primary.id &&
        s.college === college &&
        s.noticeAvailable &&
        s.name.includes(college),
    ) ?? null
  );
}
