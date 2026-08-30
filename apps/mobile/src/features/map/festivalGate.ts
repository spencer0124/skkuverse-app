/**
 * Whether this build may show festival content.
 *
 * ## Why the app needs a switch at all
 *
 * The map is fully server-driven, so an activation window opening on the server
 * is, from the app's side, a remote change to what every installed copy
 * renders: `/map/config` starts serving festival layers and chips, and the
 * booths arrive on the endpoint those layers name. Nothing in the app asks to
 * be shown a festival — it draws what it is handed. This is the one place that
 * decides whether it may be handed one, and
 * `packages/shared/src/map/festival.ts` is the pure filter that carries out the
 * decision. `CampusScreen` is the sole application point.
 *
 * ## Reading the rules
 *
 * `Updates.channel === 'beta'` rather than `!== 'production'`, which is the
 * fail-closed direction: an empty or unexpected channel in a release build
 * stays shut instead of opening. Same precedent as
 * `features/settings/SettingsScreen.tsx`, which gates its dev menu the same way.
 *
 * A function rather than a module constant, so `Updates.channel` is read at
 * render rather than at bundle init.
 *
 * **The beta channel is unlocked on purpose, and it has a consequence:**
 * TestFlight sees the festival the moment the server opens the window, with no
 * flip and no publish. That is how the feature gets exercised before release,
 * but it means opening the server is immediately visible there.
 */

import * as Updates from 'expo-updates';

/**
 * The manual override, and the only line that changes on festival day.
 *
 * - `null` — the release rules below decide: open in development and on the
 *   beta channel, shut on the App Store / Play Store.
 * - `true` — open everywhere. **This is the festival-day flip**, published with
 *   `./scripts/ota-beta.sh`, verified, then `./scripts/ota-release.sh`.
 * - `false` — shut everywhere, development included. The only way to see what a
 *   store user sees, since `__DEV__` otherwise opens the gate. Set it to check
 *   the guarded state on the simulator, and set it back before committing.
 */
const FESTIVAL_OVERRIDE: boolean | null = null;

export function isFestivalUnlocked(): boolean {
  if (FESTIVAL_OVERRIDE !== null) return FESTIVAL_OVERRIDE;
  return __DEV__ || Updates.channel === 'beta';
}
