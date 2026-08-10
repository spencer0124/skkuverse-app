---
title: Android Naver Map Custom View Marker Race
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Android Naver Map Custom View Marker Race

> Why Naver Map custom view markers disappear intermittently on Android alone, and the `renderToHardwareTextureAndroid` plus visual-dependency `key` pattern that fixes it. Read this before changing a map marker.

## The problem

Pass a React Native View as children to `NaverMapMarkerOverlay` from
`@mj-studio/react-native-naver-map` and every marker renders on iOS, while **only some of
them appear on Android**, and which ones varies between runs.

## The mechanism

A bitmap snapshot race in the Android native code, `RNCNaverMapMarker.kt`:

1. `setCustomView()` immediately calls `updateCustomView()`.
2. `updateCustomView()` captures the View into a bitmap with `draw(canvas)`.
3. **If the View has not finished layout at that moment, the result is a 1x1 transparent
   bitmap**, so the marker is invisible.
4. `ViewChangesTracker` polls every 40ms and tries to re-capture, but depending on timing
   some markers are missed.

iOS takes a synchronous snapshot with `renderInContext`, so it never hits this.

For reference: [GitHub issue #120](https://github.com/mym0404/react-native-naver-map/issues/120)
and [#143](https://github.com/mym0404/react-native-naver-map/issues/143).

## The fix

Adding the two properties below makes custom view markers render reliably on Android too.
Applied in `apps/mobile/src/features/map/components/MapMarkerLayer.tsx`.

### 1. `renderToHardwareTextureAndroid` on the child View

```tsx
<View
  collapsable={false}
  renderToHardwareTextureAndroid  // <-- added
  style={styles.dotMarker}
>
  <Text>{displayNo}</Text>
</View>
```

Rendering the View to an offscreen hardware texture first means there is a finished bitmap
to capture when `draw(canvas)` runs.

### 2. Put the visual dependency in the `key`

```tsx
<NaverMapMarkerOverlay
  key={`${key}-${marker.displayNo}`}  // <-- includes displayNo
  ...
>
  <NumberDotMarker displayNo={marker.displayNo ?? ''} />
</NaverMapMarkerOverlay>
```

This is what the library's own documentation recommends. Putting a visual dependency in the
top child's key makes React mount a fresh View, which triggers a re-capture of the bitmap.

### Preconditions that were already in place

- `collapsable={false}`, which stops Android optimising the View node away.
- Explicit `width` and `height` on both `NaverMapMarkerOverlay` and the child View.

## Alternatives considered

- Drawing markers with `react-native-svg` or `react-native-skia` is possible, but an SVG
  component is still a React Native View, so the same race can happen.
- A static PNG asset loaded through `require()` goes through Fresco and loads synchronously,
  which removes the race but does not scale.
- The current fix changes the least code and needs no platform branch.

## Related

- [docs/README.md](../README.md) — the writing rules
- The library patch `patches/@mj-studio+react-native-naver-map+2.7.0.patch` fixes a nil
  iconImage crash, which is a separate issue
