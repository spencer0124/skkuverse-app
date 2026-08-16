import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiConfig, SdsColors, SdsSpacing, SdsTypo } from '@skkuverse/shared';

import { PROD_API_URL } from '../../config/constants';

/** Floor for the strip height when there is no top safe-area inset to fill. */
const MIN_STRIP_HEIGHT = 24;

/**
 * Dev-only indicator: "this development session is talking to the production
 * API".
 *
 * ## Why this exists
 *
 * `app.config.ts`'s `resolveBaseUrl()` inverted the failure mode on purpose.
 * The old arrangement made an unset `EXPO_PUBLIC_BASE_URL` a hard error, which
 * is why a developer's `.env` was the single source of the release host and why
 * a forgotten edit could ship localhost to real users. Now an unset value means
 * `PROD_API_URL`, so a release can no longer be pointed at a laptop — but the
 * mirror-image mistake became silent instead: forget the override and your dev
 * build reads and *writes* production data with nothing on screen to say so.
 *
 * The old failure mode was invisible. This is what keeps the new one from being
 * invisible too. A `console.warn` was rejected for the job — the Metro log
 * carries far too much noise for a one-shot line to survive in it, and it is
 * gone the moment the session scrolls.
 *
 * ## Guarantees
 *
 * - **Never renders in a release.** The `__DEV__` guard is at the single call
 *   site in `app/_layout.tsx`; `__DEV__` is a literal `false` in a production
 *   bundle, so the minifier eliminates the branch. Verified against a real
 *   `expo export --platform ios` bundle: the only surviving occurrence of
 *   `DevProdHostBanner` is this module's own export definition — there is no
 *   reference to it from the layout. (`__DEV__` is also false in TestFlight,
 *   which is correct here: a TestFlight build is *supposed* to be on the
 *   production host.)
 *
 *   What that same check also showed, and what the comment should not overstate:
 *   the module itself **is still bundled**, label string included. Metro does
 *   no tree shaking by default, so an unreferenced module is dead weight rather
 *   than absent. That costs a few hundred bytes and leaks nothing — the string
 *   is a UI label, not a secret — but do not expect `grep` on a release bundle
 *   to come back empty.
 * - **Never intercepts a touch.** `pointerEvents="none"` on the root, so it is
 *   a pure overlay — nothing underneath changes behaviour because of it.
 * - **Costs no layout.** Absolutely positioned over the status-bar inset, which
 *   is the one strip of the screen no app content occupies. Nothing below it
 *   shifts, so a screen laid out with this on looks identical with it off.
 * - **No hardcoded colours.** Palette and type come from `@skkuverse/shared`
 *   tokens. `red500` is the danger token rather than the caution one on
 *   purpose: writing to production Firestore from a laptop is not a caution.
 *
 * ## How to test it — editing `.env` is NOT enough
 *
 * `ApiConfig.baseUrl` reads `Constants.expoConfig.extra`, and this project has
 * no `expo-dev-client`. In a plain `expo run:ios` debug build that object comes
 * from `EXConstants.bundle/app.config` **baked into the binary at native build
 * time** — the Metro dev server never supplies it. So changing `.env` and
 * restarting Metro with `-c` changes the JS but leaves `extra.baseUrl` exactly
 * as it was when the `.app` was compiled, across relaunches.
 *
 * This banner was once reported as "not rendering" for that reason alone: the
 * installed binary had `http://localhost:3010` baked in, so the component was
 * entered, compared correctly, and returned null — behaving perfectly while
 * looking broken. Verify the condition by logging `ApiConfig.baseUrl` inside
 * the component, or by `grep`ping the installed bundle:
 *
 *     grep -ra "localhost" "$(xcrun simctl get_app_container booted \
 *       com.example.skkumap)/EXConstants.bundle/app.config"
 *
 * Changing which host a debug build talks to requires `npx expo run:ios`, not a
 * Metro restart.
 *
 * Import direction note: `PROD_API_URL` is imported here, in the app layer.
 * `packages/shared` must not import from `apps/mobile`, so the comparison
 * cannot live next to `ApiConfig`.
 */
export function DevProdHostBanner() {
  const insets = useSafeAreaInsets();

  if (ApiConfig.baseUrl !== PROD_API_URL) return null;

  return (
    <View
      pointerEvents="none"
      // Minimum height for the case where there is no top inset at all (an
      // Android device with the status bar hidden), so the strip cannot
      // collapse to nothing and take the warning with it.
      style={[styles.strip, { height: Math.max(insets.top, MIN_STRIP_HEIGHT) }]}
    >
      <Text style={styles.label} numberOfLines={1}>
        DEV · PRODUCTION API
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: SdsColors.red500,
    alignItems: 'center',
    // Bottom-aligned rather than centred: on a notched or Dynamic Island
    // device the vertical middle of this strip is behind the cutout, and a
    // warning nobody can read is not a warning.
    justifyContent: 'flex-end',
    paddingBottom: SdsSpacing.xxs,
    paddingHorizontal: SdsSpacing.sm,
  },
  label: {
    ...SdsTypo.sub13,
    color: SdsColors.background,
    letterSpacing: 0.5,
  },
});
