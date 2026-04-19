import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';
import type { PreferencesDocument } from '../types/notifications';

/**
 * Persisted notification state — MMKV-backed like useSettingsStore.
 *
 * Why MMKV here (not just in-memory): `unreadCount` must survive app restart
 * so the app-icon / tab badge rendered by useNotificationHandler (Phase 3)
 * keeps its value across cold starts. fcmToken + deviceId are cached to
 * avoid re-reading MMKV via getOrCreateDeviceId() on hot paths.
 *
 * Option D: no Firestore `notifications` collection, so unreadCount is a
 * purely local counter that Phase 3 increments on receive and resets when
 * the user enters the 공지 탭 (useFocusEffect).
 */

export type PushPermissionStatus =
  | 'notDetermined'
  | 'authorized'
  | 'denied'
  | 'provisional';

interface NotificationState {
  fcmToken: string | null;
  deviceId: string | null;
  isTokenRegistered: boolean;
  permissionStatus: PushPermissionStatus;
  preferences: PreferencesDocument;
  unreadCount: number;
}

interface NotificationActions {
  setFcmToken: (token: string | null) => void;
  setDeviceId: (id: string | null) => void;
  setIsTokenRegistered: (v: boolean) => void;
  setPermissionStatus: (s: PushPermissionStatus) => void;
  setPreferences: (p: PreferencesDocument) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      fcmToken: null,
      deviceId: null,
      isTokenRegistered: false,
      permissionStatus: 'notDetermined',
      preferences: { enabled: false, subscribedTopics: [] },
      unreadCount: 0,

      setFcmToken: (fcmToken) => set({ fcmToken }),
      setDeviceId: (deviceId) => set({ deviceId }),
      setIsTokenRegistered: (isTokenRegistered) => set({ isTokenRegistered }),
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setPreferences: (preferences) => set({ preferences }),
      incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
      resetUnread: () => set({ unreadCount: 0 }),
    }),
    {
      name: 'notifications',
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);

/** Non-React access (background handlers, services). Identical ref to the hook. */
export const notificationStore = useNotificationStore;
