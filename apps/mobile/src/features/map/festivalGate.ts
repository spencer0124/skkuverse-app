/**
 * Whether this build may show festival content.
 *
 * ## Why this runtime needs a switch
 *
 * The map is fully server-driven, so an activation window opening on the server
 * is a remote change to what every installed copy renders. This build (OTA
 * runtime 3.5.4) predates the event map: it has no card templates, no booth
 * list, and no `layerId` on a marker. A festival reaches it as six unexplained
 * filter tiles and every one of those layers drawing the whole
 * `/map/markers/event` response as captionless dots, stacked, with taps that do
 * nothing.
 *
 * Nothing here is going to render a festival properly. This is the switch that
 * keeps it from rendering one badly, and
 * `packages/shared/src/map/festival.ts` is the pure filter that carries out the
 * decision. `CampusScreen` is the sole application point.
 *
 * ## Reading the rules
 *
 * `Updates.channel === 'beta'` rather than `!== 'production'`, which is the
 * fail-closed direction: an empty or unexpected channel in a release build
 * stays shut. Same spelling as the dev-menu gate in `SettingsScreen.tsx`.
 *
 * A function rather than a module constant, so `Updates.channel` is read at
 * render rather than at bundle init.
 */

import * as Updates from 'expo-updates';

/**
 * The manual override.
 *
 * - `null` — the release rules below decide: open in development and on the
 *   beta channel, shut on the App Store / Play Store.
 * - `false` — shut everywhere, development included. The only way to see what a
 *   store user sees, since `__DEV__` otherwise opens the gate. Set it to check
 *   the guarded state on the simulator, and set it back before committing.
 *
 * **`true` has no legitimate use on this branch.** Opening the gate here does
 * not give a 3.5.4 user a working festival; it gives them the broken one this
 * file exists to hide. The working event map ships in the next store build.
 */
const FESTIVAL_OVERRIDE: boolean | null = null;

export function isFestivalUnlocked(): boolean {
  if (FESTIVAL_OVERRIDE !== null) return FESTIVAL_OVERRIDE;
  return __DEV__ || Updates.channel === 'beta';
}
