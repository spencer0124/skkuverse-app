/**
 * What the onboarding wizard's final step should do, as a pure decision.
 *
 * Extracted from `OnboardingScreen.handleComplete` so the one branch that has
 * twice produced a production bug is directly testable. The screen keeps the
 * wiring; this owns the choice.
 *
 * `abort-no-uid` exists because the previous code did the opposite. With no
 * uid it logged `onboarding/complete-no-uid` and then fell through to
 * `completeOnboarding()`, which sat OUTSIDE the if/else — so MMKV recorded
 * "onboarding complete" while Firestore had no `preferences/main` document.
 * That combination is the ghost state: every later `update()` from the
 * department picker is a patch against a missing document and fails forever,
 * which is the 2026-07 and 2026-09 picker bug.
 *
 * The old fall-through justified itself by pointing at the `ensurePreferencesDoc`
 * self-heal in useAppInit. That self-heal is gated on `!user.isAnonymous`, is
 * not awaited, and lives inside `onAuthStateChanged` — which Android's
 * `linkWithCredential` does not fire, because it preserves the uid. So on the
 * exact path where a fresh Google account is most likely to lack a document,
 * the promised recovery never ran. Refusing to open the completion gate is the
 * only guarantee that does not depend on it.
 */
export type OnboardingCompletionDecision =
  | 'finalize'
  | 'seed-declined'
  | 'abort-no-uid';

export function decideOnboardingCompletion({
  uid,
  notificationsAccepted,
}: {
  uid: string | null | undefined;
  notificationsAccepted: boolean | null;
}): OnboardingCompletionDecision {
  if (!uid) return 'abort-no-uid';
  // Only an explicit true counts as accepted; null means the user never
  // answered, which is treated as declined intent in the SSOT.
  return notificationsAccepted === true ? 'finalize' : 'seed-declined';
}
