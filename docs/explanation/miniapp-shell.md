---
title: The Mini-App Shell
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# The mini-app shell

> How the mini-app shell (`features/web/shell/`, behind `app/mini-app.tsx`) hosts a registered mini
> app on `@skkuverse/miniapp/protocol`: which screen a URL opens in, which page may speak to the app,
> and what the page is told about the chrome. Read it before you change the shell.

## Two doors, two protocols

`/mini-app` hosts a mini app that the registry (`GET /miniapps/:id`) knows, and speaks
`@skkuverse/miniapp/protocol`. `/webview` (`features/web/browser/`) opens any other web URL and
speaks the v1 set in `packages/bridge/src/types.ts`. `openWebView` picks the screen from the URL's
origin, never from the action that linked to it, since a page on the wrong screen finds no host. A
game origin (`games.origins` in `/app/config`) opens that game's screen
([in-app-games.md](in-app-games.md)), a mini-app origin (`miniapps.origins`) opens that mini app's
shell at the URL's path, and anything else opens `/webview`.

## The origin gate: re-decided per message

The shell decides a grant on every `onMessage`, from the origin of the document that posted it
(`resolveMiniAppCapabilities` in `features/web/capabilities.rules.ts`). A web view navigates, so a
grant fixed when the screen opened would outlive the origin it was given to. The shell grants only
when the origin is in `webview.bridgeOrigins` and `miniapps.origins` maps it to this shell's id, so
a sibling mini app's page gets nothing in another app's shell. `/webview` runs the same match through
`resolveWebviewCapabilities` and grants nothing to a mini-app origin. Both lists come from
`GET /app/config`, and the gate fails closed. A grant is all or nothing, since the curated phase has
one trust level, and it holds the mini-app methods alone (`NOTIFY_METHODS`), never a `game.*` method.
A reply goes out through `hostDeliverScript`, which compares `location.origin` with the origin the
reply was computed for, so a page that has since left that origin receives nothing.

For a mini app whose origin `miniapps.origins` lists, a top-frame http(s) navigation to another origin
leaves the shell for the system browser (`decideMiniAppNavigation` in `navigation.rules.ts`), as the
game screen does. A mini app it does not list, such as one on a university host, is not pinned, so a
sign-in hop across that host's sites stays in the shell. The pin needs the WebView to report the top
frame, which iOS does. On both platforms the grant and the header follow the current origin, so no
grant depends on the pin. The service pill shows the registry's name and logo only on the app's own
origin (`toMiniAppScreenPill` in `shell/pill.rules.ts`), and the host name elsewhere, so a page on
another origin cannot borrow the app's name.

## What a page finds before its own script runs

`hostBootstrapScript` runs as `injectedJavaScriptBeforeContentLoaded`. It defines a frozen
`window.skkuverse` and sets the `--sv-*` CSS variables before first paint. The shell passes it the
start URL's origin, so it installs nothing in a sub-frame or in a document on another origin. Its
`capabilities` come from the start URL and only advertise, so a page reads them to decide whether to
draw a button and the gate decides what runs. The first viewport arrives here too, so the shell sends
`viewport.changed` only when the viewport moves. The shell installs no `window.skkuverse.bridge`,
and a page that looks for the v1 advertisement draws no action button here.

## Dispatch: one message in, at most one effect out

`shell/bridge.rules.ts` drops a message that the protocol's `parseMessage` rejects. A request carries
an `id` and always gets one answer, `denied` from an origin with no grant and `unsupported` otherwise,
so a page never waits out a timeout. A notification runs only when the grant lists its method.
`link.open` opens only what `isOpenableUrl` allows, and tries `appUrl` first only when its scheme is in
`OPENABLE_APP_SCHEMES` (`openAppFirst`). `map.openPlace` and `miniapp.open` pass through
`resolveWebAction`, which accepts an id and never a route or a URL.

## Shell: the registry decides the chrome

`GET /miniapps/:id` serves a complete `ShellConfig` (`bar`, `header`, `statusBar`, `background`), and
a field the client cannot read falls back to `DEFAULT_SHELL` in `miniAppDetailSchema`. `shell.set`
changes `header`, `statusBar` and `background` at runtime. `bar` is a layout decision that its type
leaves out, so only the mini app's manifest moves it.

- **`header: 'opaque'`** keeps a solid header with the page below it. On iOS that header is laid out
  translucent and painted with `background`, and the screen pads the page itself, for the back swipe.
- **`header: 'overlay'`** starts the page at `y = 0` under a transparent header. The page insets
  itself with `--sv-inset-*`, and the WebView never adjusts its content insets. Without Liquid Glass
  the screen draws the back and more buttons as `GlassIconButton`s, or they would vanish.
- **`bar: 'bottom'`** floats back, the service pill and forward over the page, and collapses the way
  Safari's bar does on iOS 26. The collapse is a transform alone, and the pill animates its size
  inside a fixed container, so the row never reflows. `bar: 'top'` puts the pill in the header.

## The iOS back swipe: the WebView's frame stays put

The screen under the shell, `(tabs)`, has no header. When an interactive pop starts,
react-native-screens applies that screen's config and hides the navigation bar, which then reports a
header height of `0`. Under a solid header react-native-screens offsets the content by that height,
so a back swipe started and let go moved the WebView's frame twice and the page came back scrolled
to the top. Four guards (`shell/components/useSwipeGuard.ts`) keep it in place. The iOS header is
always translucent, so the frame does not follow the bar. The header height holds still from a
closing `transitionStart` to `transitionEnd` or `gestureCancel`. A cancelled swipe restores the
document's scroll. The start URL is pinned once known, so a refetched `startUrl` never reloads the
page. `/webview` has the same header arrangement and none of these guards.

## Opening a mini app: an id, never a URL

The open helpers in `web.service.ts` push an id and an optional path, nothing else. The screen reads
the name, start URL and logo from the registry, so no caller can draw a shell that disagrees with
it. The screen upgrades a cleartext `startUrl`, which iOS App Transport Security blocks, and
`resolveMiniAppUrl` keeps a link's path on the mini app's origin. Games and mini apps share one id
namespace, so an id this build has game config for (`isGameId`) opens as a game first. A
`/m/<target>` link or a push tap reaches the same helper after mount, through `pendingMiniAppLink`.
`redirectSystemPath` in `bootstrap/deep-links/deep-links.service.ts` checks the link's shape only,
for the reason in [deep-link.md](../reference/deep-link.md#mini-app-links-are-looked-up-after-mount).

## The push toggle

A mini app with push gets a switch in the ⋯ sheet on any signed-in device, anonymous included, while
its push window is open, and after it only on a device that still receives the push
(`hasMiniAppPushToggle`). It is an anonymous user's only way off, because the notification settings
screen is behind the anonymous gate. It reads on only when the server subscription, the master
switch and the OS permission all hold.

## The feed on home

`MiniAppFeedSection` (`features/web/feed/`) draws a mini app's feed where a `miniapp_feed` section of
home's layout places it. It is one box, one grid tile high, in every state, so home never jumps when
the first entry lands. The heading opens the list at `/miniapp-feed/<id>`, and the box does what its
entry says or opens the list (`decideEntryAction`). For a mini app with push, a device that would
not receive it sees the box ask for it, and a fresh entry makes the box glow.

## Related

- [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md): why the two screens are apart
- The mini-app repository's [protocol reference](https://github.com/spencer0124/skkuverse-miniapp/blob/main/docs/reference/protocol.md), for the messages, the manifest, the viewport and the host object
