import { createMMKV } from 'react-native-mmkv';
import type { NativeGameId } from '../ids';

/**
 * This device's best score per game, for the HUD and the result card. Local
 * on purpose: it is a personal best, not a claim anyone else relies on.
 */
const mmkv = createMMKV({ id: 'games' });
const key = (gameId: NativeGameId) => `hi:${gameId}`;

export function getHighScore(gameId: NativeGameId): number {
  const n = mmkv.getNumber(key(gameId)) ?? 0;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function setHighScore(gameId: NativeGameId, score: number): void {
  mmkv.set(key(gameId), score);
}
