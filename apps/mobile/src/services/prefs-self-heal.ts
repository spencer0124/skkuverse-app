/**
 * Run a `preferences/main` write, seeding the document once if the failure
 * suggests it does not exist.
 *
 * Every writer of `users/{uid}/preferences/main` uses `update()`, a PATCH
 * mutation that cannot create a missing document. A user who is "onboarded
 * locally but absent on the server" therefore has a permanently dead write
 * path — the 2026-07 and 2026-09 department-picker ghost bug. This wrapper is
 * the single recovery point for all of them.
 *
 * ── Why `write()` runs FIRST, always ─────────────────────────────────────
 *
 * The obvious ordering — ensure() then write() — silently destroys the offline
 * behaviour these writers depend on. A Firestore write promise settles on
 * SERVER ACK, so in a campus-wifi dead spot the `await` on the seed never
 * resolves and execution never reaches the write: the change is lost with no
 * error and no log, because the promise neither resolves nor rejects. Issuing
 * the mutation first means the common case (document exists) is applied
 * locally and flushed on reconnect.
 *
 * This argument was previously stated only inside `setMiniAppSubscribed`; it is
 * the reason that function's ordering looks backwards, and it now lives here so
 * the next writer inherits it instead of rediscovering it.
 *
 * ── Deliberately import-free ─────────────────────────────────────────────
 *
 * `isRecoverable` and `onEnsureError` are injected rather than imported so this
 * module loads under `node --experimental-strip-types --test` with no React
 * Native or Firebase runtime present. That is what makes the six behaviours
 * below directly testable, which the 2026-07 fix had no way to be.
 *
 * @param write  The mutation. Called once, then at most once more after a seed.
 * @param ensure Seeds the document. Called at most once, only on a recoverable
 *               failure.
 * @param isRecoverable Classifies the write error. Pass `isMissingPrefsDocError`.
 * @param onEnsureError Observes a seed failure. The seed error is NOT
 *               propagated — the original write error is more meaningful to the
 *               caller — so this is the only place it can be logged.
 */
export async function writeWithSelfHeal<T>({
  write,
  ensure,
  isRecoverable,
  onEnsureError,
}: {
  write: () => Promise<T>;
  ensure: () => Promise<unknown>;
  isRecoverable: (err: unknown) => boolean;
  onEnsureError?: (err: unknown) => void;
}): Promise<T> {
  try {
    return await write();
  } catch (writeErr) {
    if (!isRecoverable(writeErr)) throw writeErr;

    try {
      await ensure();
    } catch (ensureErr) {
      // Surface the ORIGINAL write error: "the picker save failed" is what the
      // caller and the user care about, and a seed failure is usually a
      // downstream symptom of the same cause. Losing it entirely would be
      // silent, hence onEnsureError.
      onEnsureError?.(ensureErr);
      throw writeErr;
    }

    // Retry exactly once. If this fails, the second error is the truthful one:
    // the document now exists and the write still did not land.
    return await write();
  }
}
