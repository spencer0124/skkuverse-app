// WHY: import-free so it loads under `node --experimental-strip-types --test`.

export const EMBEDDED_BUNDLE = 'embedded';

/**
 * WHY: the full id, not a prefix: bundle ids are UUIDv7 whose leading characters are a timestamp,
 * so a prefix tells apart only bundles published over a minute apart.
 */
export function resolveOtaId(bundleId: string | null | undefined, minBundleId: string): string {
  return !bundleId || bundleId === minBundleId ? EMBEDDED_BUNDLE : bundleId;
}

/** WHY: `=== 'beta'`, not `!== 'production'`, fails closed: a build on an unexpected channel is production. */
export function isPrerelease(isDevBuild: boolean, channel: string): boolean {
  return isDevBuild || channel === 'beta';
}

/**
 * WHY: the one list of what a store build leaves out. A closed gate means absent, never a fallback
 * in its place; releasing one deletes its name here, and the compiler names every site to clean up.
 */
export const PRERELEASE_GATES = [
  'thisWeekSheet',
  'thisWeekPage',
  'buildingCounts',
  'directionsChips',
  'noticeSearchOverview',
] as const;

export type PrereleaseGate = (typeof PRERELEASE_GATES)[number];
