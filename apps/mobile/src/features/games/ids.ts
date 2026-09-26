/**
 * Games that ship inside the app. Their ids are the mini-app registry's ids,
 * so the home tile and the `/m/<id>` deep link that a server-side registry
 * entry already has open the native screen on a build that knows the game,
 * and the web mini-app on an older build that does not.
 */
export const NATIVE_GAME_IDS = ['wave-run', 'subway-typing'] as const;
export type NativeGameId = (typeof NATIVE_GAME_IDS)[number];

export function isNativeGameId(id: string): id is NativeGameId {
  return (NATIVE_GAME_IDS as readonly string[]).includes(id);
}
