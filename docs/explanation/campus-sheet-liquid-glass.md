---
title: The campus sheet's Liquid Glass card
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-29
audience: internal
---

# The campus sheet's Liquid Glass card

> Why the campus tab's bottom sheet is a floating glass card at its low detents
> and an ordinary opaque sheet at its top one, the non-obvious things that shape
> how it is built, how the modal sheets on the same screen reach the same card
> by a different route, and why the campus sheet steps aside for two of them.

On iOS 26 the campus sheet follows Apple Maps and Find My: low down it is a
card floating clear of the screen edges with all four corners rounded and the
map visible through it, and dragging it to the top detent closes the gaps and
turns the glass solid. Android and iOS below 26 keep the attached opaque sheet
this replaced on iOS 26 alone.

The geometry and the crossfade are one continuous function of gorhom's
`animatedIndex`, so they track the finger rather than flipping at a threshold.
That function is `apps/mobile/src/features/map/utils/sheetChrome.ts`, which owns
every measurement involved and is where to look for the actual numbers.

## Why the surface is a `backgroundComponent`

The sheet used to be painted by two unrelated places: `SheetHandle` supplied a
white strip with rounded top corners, and the scroll view's own style supplied
white for everything below it. Neither is a surface — together they only
resembled one because both were the same white.

That arrangement cannot express this design. `BottomSheetScrollView` fills the
whole content box, so anything drawn behind it is invisible; and a 22pt opaque
handle sitting on a translucent card reads as a lid across the top of it. So the
fill, the corner radius and the shadow all moved into a single
`backgroundComponent`, `SheetBackground`, and the handle became the grabber bar
alone.

Replacing gorhom's default background also means re-declaring the accessibility
props it sets — `accessible`, `accessibilityRole="adjustable"` and the
`"Bottom Sheet"` label. Dropping them costs nothing visible and silently stops
the sheet announcing itself to VoiceOver.

## Glass cannot be faded out, only covered

Setting `opacity: 0` on a `GlassView`, or on any of its ancestors, does not
fade the effect. It stops it rendering at all. Expo documents this, and it is
the constraint the whole component is arranged around.

So the crossfade runs the other way: the `GlassView` sits at full opacity for
the entire drag and an opaque white sibling dissolves in over the top of it.
The consequence worth remembering is about the ancestor, not the glass — the
frame that carries the card's geometry and shadow **must never take an animated
opacity**, because it would take the glass with it.

A related trap is recorded next door in
[campus-map-reconciliation.md](campus-map-reconciliation.md): a `GlassView`
renders fully transparent under a Reanimated parent carrying an `entering`
layout animation. Gorhom's sheet body is a Reanimated `Animated.View`, so this
was the main risk when the work started. It turns out an animated `style` is not
the same thing as `entering`, and the glass renders here — but that was
established by putting a throwaway `GlassView` in the background slot and
looking at it, not by reasoning, and any future glass surface under a Reanimated
parent deserves the same check.

## What may sit on the card

The fill and the geometry do not ramp together, and content has to be designed against the
fill's schedule rather than the card's. `sheetChromeAt` interpolates the inset and the corner
radius across the whole travel, but ramps `fillOpacity` over the final segment alone. So
every detent below the top one is glass, with the live map showing through, and the opaque
surface only arrives as the sheet attaches.

**Each block paints its own fill.** A block that supplies none is text over a moving map for
most of the sheet's travel, legible over a pale campus basemap and not over a satellite tile.
The blocks in place today mostly satisfy this without having been designed for it. The notice
bar carries an amber fill, while the banner and the grid tiles are opaque by construction.
The section title supplies nothing, and is the one to check first when a new palette or
basemap arrives.

**Content is not branched on the detent.** Nothing reads the sheet's index to decide what to
draw, and adding that costs more than it looks: the wrapper carrying the animated opacity may
never become an ancestor of a `GlassView`, since opacity there is an off-switch rather than a
fade. Making each block legible on glass is cheaper and does not spread the constraint.

**The sheet's content wrapper carries the only horizontal padding in the column.** The card's
inset animates, so a gutter baked into a block would be measured from an edge that moves. The
reasoning is recorded next to the dispatcher in `apps/mobile/src/sdui/renderer.tsx`.

Reaching for a `WebView` here fails on the first rule before any of the usual arguments
apply: it paints an opaque background, so it would read as a solid rectangle inside a
translucent card. The contract for what the sheet renders is
[sdui-campus-spec.md](../reference/sdui-campus-spec.md).

## The card's bottom edge has to be an explicit height

The obvious way to leave a gap under a floating card is `bottom: <gap>`. It does
not work here, and it fails invisibly.

Gorhom sizes the sheet body to the **largest** detent regardless of where the
sheet currently sits, then moves it with a translate — the height comes from
`animatedContentHeightMax` plus an over-drag padding, and the body's top is
`animatedPosition`. At the collapsed detent that puts the body's bottom edge
most of a screen *below* the visible one, so a bottom inset measured from it
lands off-screen, taking the card's bottom corners with it.

The card's bottom edge only exists relative to the sheet's **container**, so it
has to be an explicit height measured back from there:
`containerHeight - animatedPosition - gap`. The container height is the value
`CampusScreen` already measures on its root view for the locate button's anchor,
and for the same reason: the sheet's percentage detents resolve against the
container, which is not the window once the tab bar is accounted for.

## The glass rounds itself

`expo-glass-effect` exposes `borderRadius` as a native prop — the module maps it
onto `glassEffectView.cornerConfiguration`, UIKit's own corner configuration.

Use it, and never wrap glass in a rounded `overflow: 'hidden'` parent to shape
it. Clipping draws the effect square and then cuts it, so the bright specular
line along the edge stops tracing the corner and is sliced off at four points;
and because the clip masks everything outside the radius, it takes the card's
shadow with it. Letting the native prop do the work keeps Apple's continuous
corner, keeps the highlight following it, and leaves no node in the component
needing `overflow: 'hidden'` at all.

An animated radius does reach that native setter through Reanimated. That is
worth stating because it is not obvious from either side of the boundary, and it
is what lets the corners tighten continuously as the card attaches.

## Where each animated property lives

The chrome is split across two places, and the split is not arbitrary.

The **height** and the **corner radius** are animated inside `SheetBackground`,
on a childless leaf with `pointerEvents="none"`. A frame there costs one view's
layout and nothing beneath it.

The **side inset** is animated on the sheet body's own `style` prop, back in
`CampusScreen`. A margin is legal there where `left` and `right` would not be.
Gorhom composes its own absolute positioning after the supplied style, so its
rules win any collision. A margin on a box pinned to both edges simply narrows
it.

The inset has to move the background, the handle and the content as one unit.
Insetting the background alone leaves content a few points from the card's
edge. The part that actually bites is subtler: it leaves the strips either side
of the card looking like map while still belonging to the sheet's scroll view,
so a drag there moves the sheet rather than panning the map. Carrying the inset
on the body also means the content's horizontal padding is measured from the
card's edge and rides in with it, so one constant stays correct at every detent.

The cost is a layout commit on the sheet subtree per frame, against this
screen's own preference for transform-only animation — the lower control row is
anchored at `top: 0` and moved by `translateY` precisely to avoid that. It is
accepted here because the sheet already pays it: gorhom's content view animates
its own `height` and `paddingBottom` off `animatedPosition` on every frame of
every drag, in production, today. If it ever does become a problem, the escape
is to freeze the geometry below the middle detent, where it is nearly constant
anyway, so only the final segment commits layout.

## Matching the tab bar, and not matching it

The card's top corner radius when floating is the iOS 26 tab bar's own corner,
measured off a device screenshot because a native `UITabBar` publishes nothing
to read. Sharing one curve is what stops the two floating surfaces at the bottom
of this screen reading as unrelated panels.

Their widths are deliberately left different. Pulling the card in to the tab
bar's rail as well was tried and rejected on sight: matched on both axes the
card stops looking like a sheet lifted slightly off the screen and starts
looking like a panel shrunk to fit the control below it.

## Why the bottom corners are rounder than the top ones

A rounded rectangle inset by `i` stays inside a display of corner radius `R`
only while its own corners are at least `R - i`. Tighter than that and the
corner bulges past the display's curve, where the OS mask slices it off — the
card stops looking like it floats above the screen and starts looking like it
was cut by it. This went wrong once during the work, and it shows only at the
bottom two corners, since the top two sit in open screen.

So the bottom corners are held at `DISPLAY_CORNER_RADIUS - inset` while the top
two keep the design value. Each corner carries its own animated radius rather
than sharing one `borderRadius`. `expo-glass-effect` registers every per-corner
radius as a native prop, so the glass takes the same shape as the fill above
it.

`DISPLAY_CORNER_RADIUS` is the value for the screen this was built against, and
the largest in the iOS 26 device set. Largest on purpose. Overshooting on a
device with a tighter corner sets the
card's corner slightly inside the screen's, which nobody sees. Undershooting
clips. The first attempt tried
to derive it from the tab bar, reasoning that a system control nests
concentrically inside the display corner. That is wrong and worth recording: the
tab bar is a capsule, so its radius is forced by its own height rather than
chosen to fit the corner, and the value it implies is far too small. The
symptom of too small is specific — the straight edges keep their full gap while
the gap pinches shut diagonally at the corner.

## The modal sheets get the same card from gorhom rather than computing it

The layers button opens a second sheet, a booth pin or a list row opens the peek
sheet, and a building pin opens the building detail sheet. On iOS 26 every one
of them is a floating card too. They arrive there by a different route from the
campus sheet, which is worth knowing before any of them is changed. The filter
sheet is described first because it is the simplest case; the two detail sheets
take the same props and differ only in still being draggable.

The filter sheet has one snap point and both pan gestures off, so it cannot
move. Nothing has to be interpolated across a drag, which removes the
`animatedIndex` tracking, the crossfade and Reanimated along with them. What is
left is the card's box, and gorhom will hand that over: `detached` with a
`bottomInset` puts the inset on the hosting container itself, switches both that
container and the content wrapper from clipping to `overflow: 'visible'`, and
drops the content's over-drag padding. With no handle the sheet body's box is
then exactly the visible card, and a background component is handed
`StyleSheet.absoluteFillObject` — so `GlassCardBackground` is a fill and nothing
else, with no measurement in it.

None of that is available to the campus sheet. `detached` is a static mode,
while that sheet has to float low down and attach at the top, which is exactly
why its card's bottom edge has to be computed instead.

The peek sheet and the building detail sheet keep their detents and their drag,
and `detached` is fine with that: the card keeps one shape at every detent, and
only the campus sheet needs a crossfade because only it attaches at the top.
Both keep a grabber, and it is the campus sheet's `SheetHandle` — the bar alone —
because a handle that painted its own fill would be a white lid across the top
of the glass.

What does carry across unchanged: the side inset rides on the sheet body's own
`style` as a margin, for the reason given above; the accessibility props
gorhom's default background declares have to be re-declared; and the glass is
shaped by its native per-corner radii rather than by a clipping parent.

### Matching the campus card's bottom edge

The filter sheet is a modal, so it is portalled out to the root and its
container is the whole window, while the campus sheet floats inside this
screen's root view. A gap chosen locally (the safe area, say) looks right on its
own and then sits visibly above the card behind it. That was the first attempt,
and it was obvious on the device.

So `CampusScreen` restates the campus card's own bottom edge in the modal's
coordinates and passes it down as one prop to all three modals. Every card then
shares one line and one bottom corner radius, whatever the tab bar does or does
not take out of the root view's height. A constant picked to look right would
have drifted the moment either container changed.

### The backdrop had to be dimmed less

Glass samples whatever is behind it, so gorhom's default scrim turns the card
into a grey panel rather than a translucent one. Lowering it costs nothing:
`BottomSheetBackdrop` drives its touchability off `animatedIndex` rather than
off its own opacity, so tapping outside still closes the sheet.

> [!NOTE]
> `bottomInset` also shrinks the container that a percentage snap point resolves
> against, so the same percentage yields a slightly shorter sheet than it did
> while attached. Worth knowing before tuning that number.

## The campus sheet steps aside for a detail sheet

Two cards on one bottom edge is the filter sheet's arrangement, and it works
there because the filter sheet is a short-lived control the campus card sits
beside. A detail sheet is a destination, and a peek sheet rising over a campus
card that is still showing read as two sheets stacked — a second grab handle in
the same band, and the list the user was reading half-covered.

So the campus sheet hands the screen over. When a detail modal asks for it, the
campus sheet closes first; the modal is held until gorhom reports the sheet
closed, then rises from the bottom; and when the modal is dismissed the campus
sheet returns to the detent it left. The user sees one sheet go down and another
come up, in sequence, rather than one landing on top of the other.

The decisions are a pure state machine in
`apps/mobile/src/features/map/utils/sheetHandoff.ts`, tested under `node --test`
without the screen. Three of its rules are the ones that would go wrong if the
screen improvised them:

- **The restore point is the user's, not the first modal's.** A modal replacing
  another (`stackBehavior="replace"`) finds the campus sheet already closed and
  presents at once, and the detent remembered by the first request survives.
- **A closed report releases a waiting modal once.** gorhom reports every
  settled detent through one callback and closing through another; the screen
  feeds both into the same transition, and the wait is cleared on the first
  closed report, so hearing it twice presents once.
- **A release with nothing saved snaps nowhere.** A modal that never took the
  screen must not make the sheet jump on its way out.

The filter sheet is deliberately outside this. It floats beside the campus card
on the same bottom line, as the previous section describes, and closing the card
under it would leave the layers grid hanging over an empty map.

Every modal sheet also carries an explicit X, `SheetCloseButton`, pinned in a
header row above its scroll view rather than placed inside it: a sheet that can
only be dragged away looks stuck to anyone who does not know the gesture, and
inside the scroll view the X would ride out of reach the moment the content
outgrew the sheet. It is one component for the three sheets because
`useBottomSheetModal()` has to be called from inside the modal's own provider,
and each sheet renders that provider itself.

One consequence for the campus sheet's own behaviour: the effect that raises it
to the middle detent when the event list appears does nothing while a modal has
the screen. The chips stay reachable above a peek sheet, and raising the campus
sheet under it would stack the two — the hand-off restores it when the modal
goes.
