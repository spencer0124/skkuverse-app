import { create } from 'zustand';
import type { BookmarkEntry } from '../types/bookmarks';

/**
 * Bookmark state — in-memory only, NOT MMKV-persisted.
 *
 * Why no MMKV: `@react-native-firebase/firestore` enables disk persistence by
 * default. Cold start without network reads from the SDK's local cache, then
 * syncs. Persisting to MMKV on top would be a redundant cache layer fighting
 * the same data — and MMKV doesn't have the SDK's listener/merge semantics,
 * so it would reintroduce the multi-device drift problem the Firestore-SSOT
 * approach is designed to prevent.
 *
 * Hydration: `useAppInit` registers an `onBookmarksChanged` listener on the
 * authenticated user's `users/{uid}/bookmarks` collection. The listener calls
 * `setEntries` with the snapshot. On uid transition the listener is torn down
 * + reattached; on sign-out `clearEntries` is called explicitly so the next
 * anon user on a shared device doesn't see the prior owner's saved list.
 *
 * `applyLocal` exists for optimistic UI updates from the per-notice
 * `useBookmark.toggle` hook — set the entry locally before the Firestore
 * write resolves, revert on permanent error (PERMISSION_DENIED,
 * INVALID_ARGUMENT, FAILED_PRECONDITION, App Check failure). Network errors
 * are NOT reverted — Firestore's offline queue handles them, and the listener
 * re-syncs on reconnect.
 */

interface BookmarkState {
  /** Map of bookmarkKey → entry. Keyed by `${sourceId}:${articleNo}`. */
  entries: Record<string, BookmarkEntry>;
  /** True once the listener has emitted at least one snapshot for the current uid. */
  loaded: boolean;
}

interface BookmarkActions {
  /** Replace the full map — called by the Firestore listener on snapshot. */
  setEntries: (entries: Record<string, BookmarkEntry>) => void;
  /** Reset to empty + unloaded. Called on sign-out. */
  clearEntries: () => void;
  /**
   * Optimistically set or remove a single entry. Pass `null` to remove.
   * Caller is responsible for reverting on permanent server error.
   */
  applyLocal: (key: string, entry: BookmarkEntry | null) => void;
}

export type BookmarkStore = BookmarkState & BookmarkActions;

export const useBookmarkStore = create<BookmarkStore>((set) => ({
  entries: {},
  loaded: false,

  setEntries: (entries) => set({ entries, loaded: true }),
  clearEntries: () => set({ entries: {}, loaded: false }),
  applyLocal: (key, entry) =>
    set((state) => {
      const next = { ...state.entries };
      if (entry === null) {
        delete next[key];
      } else {
        next[key] = entry;
      }
      return { entries: next };
    }),
}));

/** Non-React access (services, useAppInit listener callback). Identical ref. */
export const bookmarkStore = useBookmarkStore;
