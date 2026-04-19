import { createMMKV } from 'react-native-mmkv';

/**
 * Persistent device identifier — survives app restarts, independent of FCM token.
 *
 * FCM tokens can refresh at any time (OS-driven), but the deviceId stays the same
 * until the user deletes and reinstalls the app. This maps 1:1 to a Firestore
 * `devices/{deviceId}` document.
 *
 * Uses a dedicated MMKV instance (separate from Zustand settings store).
 */

const DEVICE_ID_KEY = 'device_id';
const mmkv = createMMKV({ id: 'skkubus-device' });

let cached: string | null = null;

/** UUID v4 using Math.random — sufficient for device identifiers. */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeviceId(): string {
  if (cached) return cached;

  const existing = mmkv.getString(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const id = generateUUID();
  mmkv.set(DEVICE_ID_KEY, id);
  cached = id;
  return id;
}
