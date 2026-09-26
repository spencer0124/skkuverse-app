/**
 * "Ask this player for their profile once the app is on screen."
 *
 * The first-launch intro signs in before the navigator exists (it replaces
 * the tree in InitGate), so it cannot push /profile-setup itself. It raises
 * this flag, and PendingProfileSetupConsumer in the root layout pushes the
 * route once navigation is ready — the pending-link pattern the notice and
 * mini-app deep links use.
 */
let pending = false;
const listeners = new Set<() => void>();

export const pendingProfileSetup = {
  set(): void {
    pending = true;
    listeners.forEach((cb) => cb());
  },
  consume(): boolean {
    const p = pending;
    pending = false;
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
