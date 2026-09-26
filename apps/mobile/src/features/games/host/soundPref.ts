import { createMMKV } from 'react-native-mmkv';

/**
 * Whether the games make sound, on this device, for every game that has any.
 * On until the player turns it off; the ring/silent switch still silences it.
 */
const mmkv = createMMKV({ id: 'games' });
const KEY = 'sound';

export function getSoundOn(): boolean {
  return mmkv.getBoolean(KEY) ?? true;
}

export function setSoundOn(on: boolean): void {
  mmkv.set(KEY, on);
}
