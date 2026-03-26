import { createStore, useStore } from 'zustand';

/**
 * Auth state — pure state container driven by the mobile app.
 *
 * Does NOT import Firebase. The mobile app calls setAuthenticated/
 * setUnauthenticated in response to Firebase auth state changes.
 *
 * Flutter source: lib/core/data/api_client.dart (ensureAuth)
 */
export interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  uid: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setLoading: () => void;
  setAuthenticated: (uid: string) => void;
  setUnauthenticated: () => void;
  setError: (message: string) => void;
}

export type AuthStore = AuthState & AuthActions;

export const authStore = createStore<AuthStore>((set) => ({
  isInitialized: false,
  isAuthenticated: false,
  uid: null,
  isLoading: true,
  error: null,

  setLoading: () => set({ isLoading: true, error: null }),

  setAuthenticated: (uid) =>
    set({
      isInitialized: true,
      isAuthenticated: true,
      uid,
      isLoading: false,
      error: null,
    }),

  setUnauthenticated: () =>
    set({
      isInitialized: true,
      isAuthenticated: false,
      uid: null,
      isLoading: false,
      error: null,
    }),

  setError: (message) =>
    set({
      isInitialized: true,
      isLoading: false,
      error: message,
    }),
}));

/** React hook for consuming auth state in components */
export function useAuthStore(): AuthStore;
export function useAuthStore<T>(selector: (state: AuthStore) => T): T;
export function useAuthStore<T>(selector?: (state: AuthStore) => T) {
  return useStore(
    authStore,
    selector ?? ((s) => s as unknown as T),
  );
}
