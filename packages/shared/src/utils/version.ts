/**
 * Semver comparison for X.Y.Z version strings.
 *
 * Returns true if `current` is strictly less than `required`.
 */
export function isVersionLessThan(current: string, required: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const c = parse(current);
  const r = parse(required);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) < (r[i] ?? 0)) return true;
    if ((c[i] ?? 0) > (r[i] ?? 0)) return false;
  }
  return false;
}
