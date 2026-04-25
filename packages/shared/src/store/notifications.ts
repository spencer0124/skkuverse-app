import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';
import type { PreferencesDocument } from '../types/notifications';

/**
 * Notification state — MMKV-persisted *partially*.
 *
 * Persisted (local-only state):
 *   - unreadCount : survives app restart so the badge stays correct
 *   - fcmToken / deviceId / isTokenRegistered : cache hot-path lookups
 *   - permissionStatus : OS state cached for sync UI without re-querying
 *
 * NOT persisted (Firestore is SSOT, hydrated at launch):
 *   - preferences : populated by useAppInit's onPreferencesChanged listener.
 *     Persisting would let a stale local copy fight an authoritative server
 *     copy after another device updated it — exactly the multi-device drift
 *     this whole v5 redesign was meant to fix.
 *
 * v1 → v2 migration: preferences shape changed from { enabled, subscribedTopics }
 * to the v5 superset { enabled, categoryEnabled, pickerSelections,
 * subscribedTopics, derivedAt }. partialize now strips preferences from
 * persisted state, so existing persisted v1 data is implicitly compatible
 * (no preferences field to misread); the version bump is defensive.
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
      preferences: {
        enabled: false,
        categoryEnabled: { essential: false, services: false, notices: false },
        noticeTabEnabled: {},
        pickerSelections: {},
        subscribedTopics: [],
        derivedAt: null,
      },
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
      version: 2,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({
        fcmToken: state.fcmToken,
        deviceId: state.deviceId,
        isTokenRegistered: state.isTokenRegistered,
        permissionStatus: state.permissionStatus,
        unreadCount: state.unreadCount,
      }),
    },
  ),
);

/** Non-React access (background handlers, services). Identical ref to the hook. */
export const notificationStore = useNotificationStore;
