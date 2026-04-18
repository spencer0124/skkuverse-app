import { createStore, useStore } from 'zustand';

/**
 * Auth state — pure state container driven by the mobile app.
 *
 * Does NOT import Firebase. The mobile app calls setAuthenticated/
 * setUnauthenticated in response to Firebase auth state changes.
 *
 * Flutter source: lib/core/data/api_client.dart (ensureAuth)
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

export interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isSigningOut: boolean;
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setLoading: () => void;
  setAuthenticated: (user: AuthUser) => void;
  setUnauthenticated: () => void;
  setSigningOut: (v: boolean) => void;
  setError: (message: string) => void;
}

export type AuthStore = AuthState & AuthActions;

export const authStore = createStore<AuthStore>((set) => ({
  isInitialized: false,
  isAuthenticated: false,
  isAnonymous: true,
  isSigningOut: false,
  uid: null,
  email: null,
  displayName: null,
  photoURL: null,
  isLoading: true,
  error: null,

  setLoading: () => set({ isLoading: true, error: null }),

  setAuthenticated: (user) =>
    set({
      isInitialized: true,
      isAuthenticated: true,
      isAnonymous: user.isAnonymous,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isLoading: false,
      error: null,
    }),

  setUnauthenticated: () =>
    set({
      isInitialized: true,
      isAuthenticated: false,
      isAnonymous: true,
      uid: null,
      email: null,
      displayName: null,
      photoURL: null,
      isLoading: false,
      error: null,
    }),

  setSigningOut: (v) => set({ isSigningOut: v }),

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
