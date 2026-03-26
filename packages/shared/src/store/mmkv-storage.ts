import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * MMKV instance dedicated to settings persistence.
 *
 * Uses a separate ID to isolate from any other MMKV usage in the app.
 * MMKV is synchronous — hydration is instant, no async loading state needed.
 * This is a significant advantage over AsyncStorage/SharedPreferences.
 *
 * react-native-mmkv v4 uses Nitro Modules: MMKV is an interface, createMMKV()
 * is the factory function. The `remove()` method replaces the old `delete()`.
 *
 * Flutter source: SharedPreferences in app_shell_controller.dart
 */
const mmkv = createMMKV({ id: 'skkubus-settings' });

/**
 * Zustand StateStorage adapter backed by MMKV.
 *
 * Zustand's persist middleware expects getItem/setItem/removeItem.
 * MMKV's synchronous API maps directly — no async wrapper needed.
 */
export const mmkvStateStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => {
    mmkv.remove(name);
  },
};
