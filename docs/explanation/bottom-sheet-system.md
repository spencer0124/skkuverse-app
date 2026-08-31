---
title: The bottom sheet system
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-31
audience: internal
---

# The bottom sheet system

> One sheet component for the whole app: the three detents, the rule
> that decides whether a sheet is glass or opaque, and the non-obvious native
> constraints that shape how the card is drawn. The campus tab is where all of
> it is exercised at once, so most of the hard-won detail below is about that
> screen.

Every bottom sheet in the app is `Sheet`, in `packages/sds/src/components/sheet/`.
Before it existed there were eleven sheets built four different ways, with ten
different snap-point configurations and four different backgrounds, and adding a
sheet meant picking one of them by eye.

## The vocabulary

A sheet declares **where it sits** and **what it is made of**. It does not
declare how either is achieved.

`small` and `medium` are fractions of the sheet's container. **`large` is not a
percentage** — it is "attached to the top safe area", resolved as the container's
height less the top inset. That is what lets one definition cover a modal
portalled to the window and an inline sheet living inside a screen's root view,
and it is why the app's old collection of 82 / 85 / 90 / 92% sheets are now one
thing. The numbers are in `detents.ts`.

A position is one of four shapes:

| Shape | Meaning |
| --- | --- |
| `{ kind: 'expandable', detents: [...], initial? }` | Draggable between two or three detents |
| `{ kind: 'stuck', detent }` | One fixed height, nowhere to travel |
| `{ kind: 'stuck', height }` | One fixed height that is not a detent |
| `{ kind: 'fit' }` | Height follows the content |

`expandable` takes a tuple typed `[SheetDetent, SheetDetent, ...SheetDetent[]]`,
so "expandable needs at least two detents" is a compile error rather than a
sheet that silently cannot move. The custom `height` is deliberately one variant
deeper than `detent`, so `detent` is what autocomplete offers first — and
a custom height is not treated as `large`, whatever its value, because
`large` means "attached" rather than a number.

A sheet whose low detents matter somewhere else can override them and
keep the names, with `heights`. The campus sheet is the only case: its two lower
detents also anchor the locate button, so it supplies its own percentages and
still says `small / medium / large`. Keeping the names is the point — they are
what earns the sheet its surface.

## The rule that decides the surface

**A card is glass while it FLOATS and opaque once it ATTACHES.** `large` is the
detent that attaches.

Whether the sheet can be dragged decides only whether that change is animated or
static. It does not decide the surface. That is worth stating plainly
because the obvious alternative — "glass on draggable sheets" — makes two sheets
of identical height look different for a reason the user cannot see.

`surface="glass"` is opt-in and off by default. Glass is worth its cost over a
live map, where the map stays visible through the card. Over a
settings list it is noise, and it costs something real: every content block has
to paint its own fill to stay legible (see [What may sit on the card](#what-may-sit-on-the-card)).

`surface` and `position` together pick the mechanism:

| `surface` | position | top detent | drawn by |
| --- | --- | --- | --- |
| `solid` | any | any | `AttachedSheetBackground` |
| `glass` | `stuck` | ≠ `large` | `StuckSheetBackground`, `detached` |
| `glass` | `stuck` | `large` | `AttachedSheetBackground` |
| `glass` | `expandable` | ≠ `large` | `StuckSheetBackground`, `detached` |
| `glass` | `expandable` | `large` | `ExpandableSheetBackground` |

Only the last row costs anything per frame. `detached` is gorhom's own
floating-card mode: it moves the inset onto the hosting container, switches it
and the content wrapper from clipping to `overflow: 'visible'`, and drops the
content's over-drag padding, so the sheet body's box IS the visible card and the
background has nothing to measure. It is a **static** mode, which is exactly why
a sheet that floats low and attaches at the top cannot use it and has to compute
its card instead.

The geometry and the crossfade for that last row are one continuous function of
gorhom's `animatedIndex`, so they track the finger rather than flipping at a
threshold. That function is `chrome.ts`, which owns every measurement involved
and is where to look for the actual numbers.

## Two gestures, not one

"Can it move between detents" and "can it be swiped away" are separate
questions, and gorhom answers both with the same pair of panning props. A stuck
sheet has nowhere to travel and still closes on a downward swipe, which is what
nearly every modal in the app does — conflating the two is how eight sheets
would silently lose swipe-to-dismiss.

So `dismissible` is its own prop, defaulting to true for a modal and false for
an inline sheet. Only a sheet that is both stuck AND not dismissible turns the
panning gestures off and drops its grabber; the map's filter sheet is the one,
and it closes by its X or its backdrop.

`enablePanDownToClose` is passed explicitly rather than inherited, because
gorhom's inline sheet defaults it to `false` while its modal overrides it to
`true`. Leaving that alone is how two sheets end up behaving differently for no
stated reason.

## gorhom must be handed a ref OBJECT, never a callback ref

`BottomSheetModal.present()` registers the sheet in the provider's queue by
storing **the forwarded ref itself** — `mountSheet(key, ref, stackBehavior)` —
and the provider later closes it with `queued.ref?.current?.dismiss()`.

So the ref `Sheet` gives gorhom has to be a ref object. Hand it a callback ref,
which is what merging the caller's ref with an internal one naturally produces,
and `.current` is `undefined` on a function: the optional chain short-circuits
and **every `dismiss()` in the app becomes a silent no-op**. The sheet renders,
its close button does nothing, and nothing throws. `restore()` on a stacked
sheet goes the same way.

This reached a release once and was found only from a bug report. What made it hard to see
is that the provider's `dismiss()` still returns `true` — it found the queue
entry, it just could not call through it — so the return value says success
while nothing happens.

So `Sheet` keeps its own ref object for gorhom and gives the caller an
explicit `useImperativeHandle` that delegates to it. Those are deliberately not
the same object.

## Why the surface is a `backgroundComponent`

The campus sheet used to be painted by two unrelated places: the handle supplied
a white strip with rounded top corners, and the scroll view's own style supplied
white for everything below it. Neither is a surface — together they only
resembled one because both were the same white.

That arrangement cannot express this design. `BottomSheetScrollView` fills the
whole content box, so anything drawn behind it is invisible; and a 22pt opaque
handle sitting on a translucent card reads as a lid across the top of it. So the
fill, the corner radius and the shadow all moved into a `backgroundComponent`,
and the handle became the grabber bar alone.

Replacing gorhom's default background also means re-declaring the accessibility
props it sets — `accessible`, `accessibilityRole="adjustable"` and the
`"Bottom Sheet"` label. Dropping them costs nothing visible and silently stops
the sheet announcing itself to VoiceOver. They live in one place,
`SHEET_BACKGROUND_A11Y`, which is most of the reason to have one component.

## Glass cannot be faded out, only covered

Setting `opacity: 0` on a `GlassView`, or on any of its ancestors, does not fade
the effect. It stops it rendering at all. Expo documents this, and it is the
constraint the whole component is arranged around.

So the crossfade runs the other way: the `GlassView` sits at full opacity for
the entire drag and an opaque white sibling dissolves in over the top of it. The
consequence worth remembering is about the ancestor, not the glass — the frame
that carries the card's geometry and shadow **must never take an animated
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
fill's schedule rather than the card's. `sheetChromeAt` interpolates the side inset and the
corner radius across the whole travel, but ramps `fillOpacity` over the final segment alone.
So every detent below the top one is glass, with the live map showing through, and the opaque
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
inset animates, so a gutter baked into a block would be measured from an edge that moves. This
is also why `Sheet` does not bake a gutter into its own content wrapper the way the SDS
`BottomSheet` it replaced did — a sheet that wants one says so. The reasoning is recorded next
to the dispatcher in `apps/mobile/src/sdui/renderer.tsx`.

Reaching for a `WebView` here fails on the first rule before any of the usual arguments
apply: it paints an opaque background, so it would read as a solid rectangle inside a
translucent card. The contract for what the campus sheet renders is
[sdui-campus-spec.md](../reference/sdui-campus-spec.md).

## The card's bottom edge has to be an explicit height

The obvious way to leave a gap under a floating card is `bottom: <gap>`. It does
not work for a crossfading sheet, and it fails invisibly.

Gorhom sizes the sheet body to the **largest** detent regardless of where the
sheet currently sits, then moves it with a translate — the height comes from the
container height plus an over-drag padding, and the body's top is
`animatedPosition`. At the collapsed detent that puts the body's bottom edge
most of a screen *below* the visible one, so a bottom inset measured from it
lands off-screen, taking the card's bottom corners with it.

The card's bottom edge only exists relative to the sheet's **container**, so it
has to be an explicit height measured back from there:
`containerHeight - bottomGap - animatedPosition`.

That container height is read from gorhom rather than passed in.
`backgroundComponent` renders inside `BottomSheetInternalProvider`, so
`useBottomSheetInternal()` resolves there and `animatedLayoutState` already
carries the height gorhom itself resolves percentage detents against. One
`useAnimatedReaction` mirrors "has it been measured yet" back to JS, which is
all the render-time fallback branch needs. Taking it as a prop would mean every
host measured its own root view and hoped the two agreed.

### The bottom gap is not the side gap

They are the same 8pt for an inline sheet and they are not the same number for a
modal, because the gap is measured from the card's own **container** and those
containers differ. An inline sheet's container is the host screen's root view,
whose bottom edge already sits above the tab bar. A modal is portalled to the
root and its container is the whole window.

A gap chosen locally (the safe area, say) looks right on its own and then sits
visibly above the card behind it. That was the first attempt, and it was obvious
on the device. So `CampusScreen` restates the campus card's own bottom edge in
the modal's coordinates and passes it down as one `bottomGap` prop to all three
modals. Every card then shares one line and one bottom corner radius, whatever
the tab bar does or does not take out of the root view's height.

So `sheetChromeAt` returns `progress` rather than one gap: the caller
scales its own float-state gap by `1 - progress` and arrives at the same
schedule as the side inset.

> [!NOTE]
> `bottomInset` also shrinks the container that a percentage snap point resolves
> against, so the same percentage yields a slightly shorter sheet than it did
> while attached. Worth knowing before tuning that number.

### A crossfading modal has to pay for its own gap

A `detached` sheet gets its content box shrunk to the visible card for free. A
crossfading one does not. Gorhom sizes the content to the container, so a long
list keeps drawing below the card's bottom edge, over the map, at the low
detent. `EventMapPeekSheet` is the only sheet in this position, and it adds
`bottomGap` to its scroll content's bottom padding — constant rather than
animated, because the extra band is invisible once the sheet attaches and the
floating tab bar sits over it anyway.

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

The **height** and the **corner radius** are animated inside
`ExpandableSheetBackground`, on a childless leaf with `pointerEvents="none"`. A
frame there costs one view's layout and nothing beneath it.

The **side inset** is animated on the sheet body's own `style` prop, in
`Sheet.tsx`. A margin is legal there where `left` and `right` would not be.
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

The cost is a layout commit on the sheet subtree per frame, against the campus
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
of the campus screen reading as unrelated panels.

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

So `bottomCornerRadius` holds the bottom corners at `DISPLAY_CORNER_RADIUS - gap`
while the top two keep the design value. Each corner carries its own animated
radius rather than sharing one `borderRadius`. `expo-glass-effect` registers
every per-corner radius as a native prop, so the glass takes the same shape as
the fill above it. Both backgrounds call the same function, which is what makes
the stuck card and the crossfading one agree at the same gap.

`DISPLAY_CORNER_RADIUS` is the value for the screen this was built against, and
the largest in the iOS 26 device set. Largest on purpose. Overshooting on a
device with a tighter corner sets the card's corner slightly inside the screen's,
which nobody sees. Undershooting clips. The first attempt tried to derive it from
the tab bar, reasoning that a system control nests concentrically inside the
display corner. That is wrong and worth recording: the tab bar is a capsule, so
its radius is forced by its own height rather than chosen to fit the corner, and
the value it implies is far too small. The symptom of too small is specific — the
straight edges keep their full gap while the gap pinches shut diagonally at the
corner.

## The backdrop had to be dimmed less

Glass samples whatever is behind it, so a standard scrim turns the card into a
grey panel rather than a translucent one. So `Sheet` picks its scrim from
`surface`: `SdsColors.scrim` behind a solid sheet, `SdsColors.scrimGlass` — far
lighter — behind a glass one. Lowering it costs nothing: `BottomSheetBackdrop`
drives its touchability off `animatedIndex` rather than off its own opacity, so
tapping outside still closes the sheet.

The alpha lives in the token rather than beside it, so gorhom's `opacity` prop
is purely the animation target and `1` means "ramp all the way to the token's
own value".

## The campus screen's sheets

Four sheets, and never two at once.

| Sheet | Position | Surface |
| --- | --- | --- |
| Campus sheet (inline) | `expandable` `small / medium / large`, low two overridden | glass, crossfading |
| Filter / layers | `stuck` `medium`, not dismissible, backdrop | glass, static card |
| Event peek | `expandable` `small / large` | glass, crossfading |
| Building detail | `stuck` `large` | attaches, so plain opaque |

The building detail sheet is the one to look at twice. It used to be a floating
glass card at 85%, and under the surface rule a `large` sheet attaches, so it is
now an ordinary opaque sheet. That is deliberate rather than an oversight — it
still declares `surface="glass"`, which states the family it belongs to and
would give it the card back unchanged if a lower detent were ever added.

### The campus sheet steps aside for a detail sheet

Stacking two cards on one bottom edge is the filter sheet's arrangement, and it works
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
on the same bottom line, and closing the card under it would leave the layers
grid hanging over an empty map.

Every modal sheet also carries an explicit X, `SheetCloseButton`, pinned in a
header row above its scroll view rather than placed inside it: a sheet that can
only be dragged away looks stuck to anyone who does not know the gesture, and
inside the scroll view the X would scroll away the moment the content
outgrew the sheet. It is one component rather than a prop because
`useBottomSheetModal()` has to be called from inside the modal's own provider.

One consequence for the campus sheet's own behaviour: the effect that raises it
to the middle detent when the event list appears does nothing while a modal has
the screen. The chips stay reachable above a peek sheet, and raising the campus
sheet under it would stack the two — the hand-off restores it when the modal
goes.
