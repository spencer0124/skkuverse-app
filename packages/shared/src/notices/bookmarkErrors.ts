/**
 * Classify a bookmark toggle error to decide whether the optimistic UI update
 * should be reverted.
 *
 * Permanent: the write will NEVER succeed in the current state — Rules
 * rejection, malformed data, missing index, App Check failure. Optimistic UI
 * MUST revert + show a toast, otherwise the user sees a "saved" icon for a
 * notice that doesn't exist on the server.
 *
 * Transient: the write is queued / retrying / temporarily failed (network
 * dead-spot, deadline exceeded, unknown). The Firestore SDK's offline queue
 * handles these — surfacing them as rollbacks would create noisy UX on every
 * campus-wifi dead spot. Trust the listener to converge.
 *
 * Default-safe bias: anything we don't recognize falls back to 'transient'.
 * Reverting on an unknown error is worse than leaving an optimistic state
 * for the listener to correct on next snapshot.
 *
 * App Check failures from the Firestore client surface as
 * `firestore/permission-denied` (server rejects token before evaluating
 * Rules) or `firestore/unauthenticated`, both classified as permanent.
 */

const PERMANENT_CODES = new Set([
  'permission-denied',
  'invalid-argument',
  'failed-precondition',
  'unauthenticated',
]);

export function classifyBookmarkToggleError(
  err: unknown,
): 'permanent' | 'transient' {
  if (!err || typeof err !== 'object') return 'transient';
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return 'transient';
  // Strip optional namespace prefix (e.g. "firestore/permission-denied").
  const last = code.includes('/') ? code.slice(code.lastIndexOf('/') + 1) : code;
  return PERMANENT_CODES.has(last) ? 'permanent' : 'transient';
}
