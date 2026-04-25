/**
 * Exponential-backoff retry wrapper.
 *
 * Delay schedule for maxAttempts = 3: 1s → 2s → (then throw on 4th attempt).
 * The multiplier is 2^attempt × 500ms, so `maxAttempts = 3` waits 1s + 2s + 4s
 * across attempts 1, 2, 3 before giving up.
 *
 * Used at the useAppInit boundary so that transient Firestore / network
 * failures during notification bootstrap don't block app launch — on final
 * exhaustion the caller reports to Crashlytics and continues.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      const delay = 2 ** attempt * 500; // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
