/**
 * Decide whether a failed `preferences/main` write might be failing because the
 * document does not exist — i.e. whether seeding it and retrying is worth doing.
 *
 * Every writer of `users/{uid}/preferences/main` uses `update()`, which is a
 * PATCH mutation: it cannot create a missing document. A user who is "onboarded
 * locally but absent on the server" therefore has a permanently dead write path,
 * which is exactly the 2026-07 and 2026-09 department-picker ghost bug.
 *
 * `permission-denied` is the load-bearing entry, and it is not obvious.
 * `firestore.rules` gates `allow update` on `resource.data.diff(...)` and
 * `resource.data.onboardedAt`; with no document `resource` is null, the
 * condition cannot evaluate true, and the client is told PERMISSION_DENIED.
 * **Firestore never reports the absence as `not-found` through a security
 * rule.** Pinned empirically in `apps/mobile/firestore.rules.test.mjs`,
 * "update() on a MISSING preferences doc → deny with permission-denied".
 *
 * This is why the 2026-08-19 self-heal in `setMiniAppSubscribed`, which tested
 * `code !== 'firestore/not-found'`, never once fired — the same defect class as
 * the 2026-07 `essential: false` seed: a recovery path structurally incapable
 * of running. Narrowing this predicate back to `not-found` reintroduces it.
 *
 * The ambiguity is real and accepted: `permission-denied` is also what a
 * GENUINE rules violation returns. Treating it as "maybe missing" is safe only
 * because of the failure ordering in `writeWithSelfHeal` — the seed is attempted
 * once, and if the write still fails the caller sees the real error. A true
 * rules violation therefore costs exactly one wasted create, never a wrong
 * outcome.
 *
 * Transient codes are deliberately excluded. `unavailable` and
 * `deadline-exceeded` mean a campus-wifi dead spot, where the Firestore offline
 * queue will flush the original write on reconnect; seeding there would create
 * documents for users who never needed one.
 */

const RECOVERABLE_CODES = new Set(['permission-denied', 'not-found']);

export function isMissingPrefsDocError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return false;
  // Strip optional namespace prefix (e.g. "firestore/permission-denied").
  const last = code.includes('/') ? code.slice(code.lastIndexOf('/') + 1) : code;
  return RECOVERABLE_CODES.has(last);
}
