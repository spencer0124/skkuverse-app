---
title: The Shared Map
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# The Shared Map

> The reasons one map under the map and transit tabs relies on across files. Read it before you add
> a sheet kind, a place kind or a chip, or before you touch `app/(tabs)/`.

The decisions are [ADR 0022](../decisions/0022-places-open-on-the-map-intents-start-in-transit.md),
[ADR 0023](../decisions/0023-custom-tab-bar-with-glass-on-ios-26.md) and
[ADR 0024](../decisions/0024-rest-every-map-sheet-on-one-detent-scale.md).

## Two shells, one override

Every build runs the shared-map shell. The native-tabs shell stays in the bundle behind the local
`SHELL_OVERRIDE` until it retires, so shared code still has to work under it: home and notices are
the same screens in both. No feature asks which shell runs. The route or the shell passes each difference in as data: a view table
(`MapSheetViews`, with `MapSheetCards` spread over it by `NativeMapScreen`), `tabScope`, the place
opener `app/_layout.tsx` registers (`openPlaceAsScreen` under the native tabs, which have no map
under a page), and the `/bus/realtime` and `/subway` routes, which redirect to a transit sheet
under the shared map.

## A tab's task is a sheet stack

The shared shell keeps the last map tab focused while home or notices is in front, so that tab's
stack and lenses hold still. No view moves the sheet. One rule, `decideSheetMove`
(`features/map/sheet-stack.rules.ts`), runs after each commit: a body just pushed opens at the level
its entry records, and a body that a pop reveals returns to the level it was covered at. Gorhom
keeps its index across a change of snap points, so without that reveal a body would take the
covering sheet's index. A view that snapped its own sheet raced the reveal in one commit.

## What a layer shows: five tiers

`isLayerVisible` (`features/map/layers.rules.ts`) resolves every layer as

```text
locked ?? stackLens ?? userToggle ?? tabDefault ?? defaultVisibleAt(layer, now)
```

- `stackLens` is what the focused tab's open sheets name, the higher entry winning per layer. A
  chip's narrowing and a line's route are one mechanism, so a line opened over a chip needs no
  second rule. It outranks the user's toggle: a line's route shows even when the user switched that
  layer off, and closing the sheet gives their setting back.
- `userToggle` is the user's `overrides`, shared by both tabs.
- `tabDefault` hides each layer whose `tabs` leaves the tab out, an absent `tabs` meaning the map
  tab alone, so the festival stays out of the transit tab.
- `defaultVisibleAt` is the served schedule at the current time.

Every tier is a fallback, never an assignment. `useMapStore` holds only what the user expressed,
and a chip is an entry on its tab's stack, so releasing it writes nothing. A resolved value written
into the store would freeze the schedule at its first read. It would also make the user's choice
indistinguishable from the server's, so clearing a chip would wipe the user's choices.

## Lenses: what an open sheet lays over the map

A sheet changes the map in two ways. The **layer lens** is set by the opener at push
(`entry.layers`), lives with the entry, and is `stackLens` above. The **overlay lens** is the task's
own pins, labels and header, published by the mounted view through `useSheetLens`. It lasts until
the entry leaves the stack, even after the view unmounts under a sheet pushed above it, so a line's
stop pins stay drawn under a stop opened from it.

A view publishes every overlay it has, each tagged with a role, and the profile of the top sheet
names the roles each level keeps (`applyMapLens`), so a view never reasons about where its sheet
rests. `overlayLensOf` (`features/map/sheet-lens.rules.ts`) merges the focused tab's lenses lowest
first. One overlay is kept per place id, the higher sheet's, with the lower one's subtitle when it
has none: that is how a focused stop keeps the direction its line gave it.

## Each sheet keeps its own camera

Every entry records the camera last settled over it (`rememberCamera`). A pop or a dismiss that
reveals it jumps the map back (`cameraOnReveal`, then `decideRestore`), unless a locate press or a
chip tap still waits for its camera. A tab switch restores nothing, because the shared camera is
what carries a place from one tab into the other (ADR 0022 rule 2).

The camera is the visible map. The host pads the SDK's content area by the top chrome, the focused
tab's sheet and the tab bar (`visibleMapPadding`), and the SDK keeps the visible map still when the
padding changes, so a frame is placed in the band between the chrome and the sheet. A view frames only
after the host reports `visibleMapReady`, and the padding follows a drag only between levels whose
framing is `fit`.

## Where a place opens

A pin tap opens in the focused tab, and a link in the tab it names. A page's "view on map" opens
the place in its home tab (`SHEET_KIND_HOME_TAB`). A search result, or a place whose page names
itself as the origin, opens in the map tab beneath the screen, else in the home tab. A deep link, a
push, a page or a web view starts the task over, since what was open is not that request's context,
and a request made in the app opens on top like a pin (`decideLinkArrival`).

### A place a page opened returns to the page

A page above the tabs can name itself as a place's origin (`PageOrigin`, ADR 0022 d7). The page
passes it itself, because by the time a service runs, the route in front is no longer the page.
Only the user's own close of that entry pushes the page back (`decideClose`). Leaving the tab drops
every origin on both map tabs, keyed on the focused route rather than the host's map tab, which
holds still while home or notices is in front. The page pushed back is a new screen, since
`dismissTo` destroyed the old one, so the campus route page restores its view from
`routeViewSnapshots`.

## The map and transit boundary

Transit imports the map at run time (`useSheetLens`, the host's door hooks, `useMapPlaces`). The map
names transit only through `import type` (`TransitSheetRequest` in
`features/map/sheet-stack.types.ts`), which the build erases. The feature-cycle test
(`scripts/architecture/feature-cycles.test.mjs`) counts runtime imports only, so the graph keeps one
edge, transit to map, and a runtime import of transit from a map file fails it.

Transit and map meet in `SharedMapShell`, which composes `TransitSheetViews` beside `MapSheetViews` and
mounts `TransitPlaceFeed` inside `MapHost` to feed the stops and stations as places. A place kind
from a third feature takes the same path: a request type the map imports as a type, a row in
`SHEET_KIND_HOME_TAB`, a view table and a feed. Its view def carries what the map cannot know about
a kind it does not own (`keyOf`, `fromPlace`, `layersFromFeed`).

## What the shared shell rebuilds

The shell owes what NativeTabs gave for free (ADR 0023 decision 3), decided in
`apps/mobile/src/bootstrap/tab-bar.rules.ts`. Each item below names the trap, where there is one:

- **The tab slot.** `TabSlot` keeps `detachInactiveScreens={false}`, because the default native
  screen container takes every touch, and `pointerEvents` cannot stop it. Box-none goes in the slot's
  `style`, since `TabSlot` ignores a `pointerEvents` prop. The shell renders its own slot because
  upstream's `renderFadingTabScreen` took every touch, and it moves a hidden tab off screen, since
  Fabric unmounts and remounts a `display: 'none'` tab natively on every switch.
- **No Stack under the map tabs.** The campus and transit `_layout.tsx` are a `<Slot/>`, since a
  nested Stack's screen takes the touch and paints over the map. A page opened from either tab
  pushes on the root Stack.
- **Android back.** The tab router's own back is `'none'` (`TAB_BACK_BEHAVIOR`). Its default goes
  to the first route, which is the restored tab, so a cold start on a map tab looped between that
  tab and home. The shell's back collapses a part-way sheet, pops, and at a map or notices root
  goes home.
- **The bottom inset** (`useTabBarInset`) stays the expanded capsule's edge while the bar is
  minimized, and a map sheet drives the shrink only where gorhom lets its list scroll.
- **A selection** presses the tab's own trigger, so it emits the `tabPress` that pops a Stack to its
  root. A re-tap pops a map tab's task to its root and scrolls any other tab to the top.
- **Screen readers** get no map, and a sheet that opens at its top level and pops at once on back.
- **Tab analytics and `lastTab`** come from the route the shell shows. `useTabFocusTracking` stays
  out, so nothing logs twice.

## Related

- [ADR 0008](../decisions/0008-campus-camera-reconciliation.md): the campus card and camera requests
- skkuverse-server `docs/reference/event-places.md`: how an event place is stored and switched on
- [bottom-sheet-system.md](bottom-sheet-system.md): the `Sheet` component and the card hand-off
- skkuverse-server `docs/reference/map-overlays-api.md` §8.9: `tabs`, `opensIn` and `layers` chips
