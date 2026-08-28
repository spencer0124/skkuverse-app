---
title: The campus sheet's Liquid Glass card
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-28
audience: internal
---

# The campus sheet's Liquid Glass card

> Why the campus tab's bottom sheet is a floating glass card at its low detents
> and an ordinary opaque sheet at its top one, and the four non-obvious things
> that shape how it is built.

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
Insetting the background alone leaves the search bar a few points from the
card's edge. The part that actually bites is subtler: it leaves the strips
either side of the card looking like map while still belonging to the sheet's
scroll view, so a drag there moves the sheet rather than panning the map. Carrying the inset
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
