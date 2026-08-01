/**
 * Mini-app shell entry point.
 *
 * A mini-app is a REGISTERED service — it exists in the server-owned registry
 * (`GET /miniapps`), which is what earns it the shell's chrome: service pill,
 * verified badge, related links, share-as-mini-app-link, add-to-home.
 *
 * Only an id crosses the route boundary. Name, startUrl, logo and the rest are
 * resolved on the screen from the registry, so exactly one place knows what a
 * mini-app is. Threading a name/URL through params (as the bundled-registry
 * version did) would let a caller render a shell that disagrees with the
 * registry it claims to represent.
 *
 * Arbitrary URLs do NOT belong here — that is `features/webview/open.ts`. The
 * old `openInAppBrowser()` wrapper that quietly routed them into this shell is
 * gone on purpose.
 */
import { router } from 'expo-router';

/** Open a registered mini-app by slug. Unknown slugs surface on the screen. */
export function openMiniAppById(id: string): void {
  router.push({ pathname: '/mini-app', params: { id } } as never);
}
