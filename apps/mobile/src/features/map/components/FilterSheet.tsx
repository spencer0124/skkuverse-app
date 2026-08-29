/**
 * Filter bottom sheet — the full filter surface.
 *
 * Two data sources with two lifetimes, deliberately kept apart: the campus and
 * base-layer tiles come from `/map/config` and are permanent, while the event
 * sections come from the snapshot and vanish with the event. They share a sheet
 * because they answer the same user question ("what is on my map"), not because
 * they are the same kind of thing.
 *
 * Every chip group lives here, including the ones `EventMapChipRow` also shows.
 * That is not duplication: the row carries the unlabelled groups as one-tap
 * toggles, and this is where a group with a heading can actually have one.
 *
 * No sort control. Sort is only observable in the list, so a selector here would
 * be a control that appears to do nothing — see `EventMapListSheet`.
 *
 * Campus and layer are thumbnail tiles rather than text pills. A pill row states
 * what a layer is called; a tile shows what turning it on does to the map, which
 * is the actual question. The event groups stay on `FilterPill` on purpose —
 * they are open-ended server strings with no map appearance to preview, so a
 * tile would promise a picture it cannot draw.
 *
 * On iOS 26 the sheet is a floating Liquid Glass card rather than a panel
 * welded to the screen edges, matching the campus sheet behind it. It gets
 * there by a different route, though — see `GlassCardBackground`.
 */

import { forwardRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetModal,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { XIcon } from 'phosphor-react-native';
import {
  isLayerVisible,
  useMapLayerStore,
  useT,
  type Campus,
  type MapConfig,
  type MapLayerDef,
  SdsColors,
  SdsTypo,
  SdsSpacing,
} from '@skkuverse/shared';
import { MapTile } from './MapTile';
import type { MapThumbPalette } from './MapThumb';
import { GlassCardBackground } from './GlassCardBackground';
import { toCssColor } from '../utils/toCssColor';
import { SHEET_FLOAT_INSET } from '../utils/sheetChrome';
import { GLASS_AVAILABLE } from '@/components/glass';
import { logLayerToggle } from '@/services/analytics';

/**
 * Per-campus tile art. Exhaustive over `Campus`, which is a closed union derived
 * from `CAMPUSES`, so adding a campus is a type error here rather than a tile
 * that silently renders as the wrong place.
 */
const CAMPUS_ART: Record<Campus, { palette: MapThumbPalette; emoji: string }> = {
  hssc: { palette: 'basic', emoji: '\u{1F3DB}\u{FE0F}' },
  nsc: { palette: 'terrain', emoji: '\u{1F52C}' },
};

/**
 * Per-layer badge glyph. A plain lookup with a fallback rather than an
 * exhaustive record, because `MapLayerDef.id` is a genuinely open server string:
 * the server can ship a layer this app has never heard of, and it has to render.
 */
const LAYER_EMOJI: Readonly<Record<string, string>> = {
  building_numbers: '\u{1F522}',
  building_labels: '\u{1F3E2}',
};
const LAYER_EMOJI_FALLBACK = '\u{1F4CD}';

/**
 * What a layer's tile shows in the middle.
 *
 * The two building layers get a hand-picked emoji, because there are exactly two
 * of them and they are permanent. Everything else is server-driven and arrives
 * with no emoji to pick — the six festival layers would all land on the same
 * fallback pin, which tells the user nothing about which is which. Those get a
 * dot in the layer's own colour instead, which is the one thing the server does
 * say and is exactly what their markers draw on the map.
 */
function LayerBadge({ layer }: { layer: MapLayerDef }) {
  const emoji = LAYER_EMOJI[layer.id];
  if (emoji) return <Text style={styles.badgeEmoji}>{emoji}</Text>;
  if (layer.style?.color) {
    return (
      <View
        style={[
          styles.badgeDot,
          { backgroundColor: toCssColor(layer.style.color, SdsColors.brand) },
        ]}
      />
    );
  }
  return <Text style={styles.badgeEmoji}>{LAYER_EMOJI_FALLBACK}</Text>;
}

/**
 * The close button lives in its own component because `useBottomSheetModal()`
 * reads context the modal provides — calling it in `FilterSheet` itself, which
 * renders that modal, would read from outside its own provider.
 */
function SheetCloseButton({ label }: { label: string }) {
  const { dismiss } = useBottomSheetModal();
  return (
    <Pressable
      onPress={() => dismiss()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.close}
    >
      <XIcon size={18} color={SdsColors.grey700} weight="bold" />
    </Pressable>
  );
}

interface FilterSheetProps {
  mapConfig: MapConfig;
  /**
   * Where the card stops, measured from the window's bottom edge.
   *
   * Passed in rather than derived here, because it has to land on the same line
   * as the campus sheet's own card and only that screen knows where that is:
   * this sheet is a modal whose container is the whole window, while the campus
   * sheet floats inside the root view that screen measures. A safe-area value
   * computed locally would look right in isolation and sit visibly higher than
   * the card behind it.
   */
  bottomGap: number;
}

export const FilterSheet = forwardRef<BottomSheetModal, FilterSheetProps>(
  function FilterSheet({ mapConfig, bottomGap }, ref) {
    const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
    const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);
    const layers = useMapLayerStore((s) => s.layers);
    const toggleLayer = useMapLayerStore((s) => s.toggleLayer);

    /**
     * Tap-outside-to-close.
     *
     * The index props are not decoration: `BottomSheetBackdrop` defaults to
     * appearing at index 1 and disappearing at index 0, which on a
     * single-snap-point sheet means it is hidden for the entire time the sheet
     * is open. Index 0 IS the open state here, so it has to appear there and
     * only leave at -1 (dismissed).
     *
     * `opacity` is well below the 0.5 default because glass samples whatever is
     * behind it: a half-black scrim over the map turns the card into a grey
     * panel rather than a translucent one. Dimming less costs nothing here —
     * the backdrop's touchability is driven by `animatedIndex`, not by how
     * opaque it is, so tapping out still closes the sheet.
     */
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={BACKDROP_OPACITY}
          pressBehavior="close"
        />
      ),
      [],
    );

    /**
     * A closure rather than the component itself, because the card's bottom gap
     * is measured here and gorhom passes a background component only its own
     * animated values.
     */
    const renderBackground = useCallback(
      (props: BottomSheetBackgroundProps) => (
        <GlassCardBackground {...props} bottomGap={bottomGap} />
      ),
      [bottomGap],
    );

    const handleCampusPress = useCallback(
      (campusId: Campus) => {
        setSelectedCampus(campusId);
      },
      [setSelectedCampus],
    );

    const { t } = useT();

    return (
      <BottomSheetModal
        ref={ref}
        // One snap point, because the sheet no longer moves: with both panning
        // gestures off there is no way to reach a second one, so listing it
        // would be dead config that reads as a feature.
        snapPoints={['62%']}
        enableDynamicSizing={false}
        // No handle, and no dragging by handle or by content. Dragging the
        // content is what would otherwise fight the grid: a downward swipe
        // meant to scroll to the layers would instead pull the sheet shut.
        handleComponent={null}
        enableHandlePanningGesture={false}
        enableContentPanningGesture={false}
        backdropComponent={renderBackdrop}
        backgroundComponent={renderBackground}
        // `detached` is what turns the sheet body's box into the visible card:
        // it stops the container `bottomInset` short of the screen and switches
        // the clipping off, so the shadow and the glass edge survive. It is a
        // static mode, which is why the campus sheet cannot use it and why this
        // one can. All three go off together below iOS 26, where the sheet stays
        // the attached full-width panel it shipped as.
        detached={GLASS_AVAILABLE}
        bottomInset={GLASS_AVAILABLE ? bottomGap : 0}
        // A margin, not `left`/`right`: gorhom composes `[style, styles.container,
        // animated]` and its own `left: 0`/`right: 0` would win. It has to ride
        // on the body so the background, the content and its padding all inset
        // as one unit — insetting the background alone would leave the strips
        // either side of the card belonging to the sheet while looking like map.
        style={GLASS_AVAILABLE ? styles.card : undefined}
        // It can now be opened while the peek sheet is up, and the default
        // 'switch' would minimise that sheet and resurface it on close.
        stackBehavior="replace"
      >
        {/* A sibling of the scroll view, not its first row. Inside it, the X
            would ride up and out of reach the moment the content grew past the
            sheet — and closing has to stay one tap away at every scroll
            position. That makes 캠퍼스 a pinned sheet title rather than a
            heading that scrolls with its own grid, which is how the reference
            sheet behaves too. */}
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, styles.headerTitle]}>{t('filter.campus')}</Text>
          <SheetCloseButton label={t('common.close')} />
        </View>

        {/* `bounces` is what makes a short sheet feel draggable when it is not:
            iOS rubber-bands a ScrollView even with nothing to scroll, so the
            whole content slides under the finger and springs back. Off, the
            content moves only as far as it actually extends, and once it does
            outgrow the sheet it still scrolls normally, just without the
            overscroll at either end. `overScrollMode` is the Android half. */}
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          bounces={false}
          overScrollMode="never"
        >
          {/* Same four-column track as the layer grid below. Tying the tile to
              a shared column width rather than to each section's item count is
              what keeps the two grids reading as one set — a wider campus tile
              made the section above look like a different control. */}
          <View style={styles.grid}>
            {mapConfig.campuses.map((campus) => {
              const art = CAMPUS_ART[campus.id];
              return (
                <View key={campus.id} style={styles.col}>
                  <MapTile
                    label={campus.label}
                    selected={campus.id === selectedCampus}
                    onPress={() => handleCampusPress(campus.id)}
                    palette={art.palette}
                    badge={<Text style={styles.badgeEmoji}>{art.emoji}</Text>}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>{t('filter.layer')}</Text>
          <View style={styles.grid}>
            {mapConfig.layers
              // `userConfigurable` governs the affordance, not the capability: a
              // locked layer still renders, still fetches and is still
              // deep-linkable — only its control disappears. Absent means true,
              // so an older server loses nothing.
              .filter((layer) => layer.userConfigurable !== false)
              .map((layer) => {
                // The same function CampusScreen renders with, which is what
                // keeps this control honest — it once read `layers[id]?.visible`
                // alone and showed 건물번호 ON while the map was hiding it. It is
                // one function rather than a repeated expression for exactly
                // that reason.
                const visible = isLayerVisible(layer, layers);
                return (
                  <View key={layer.id} style={styles.col}>
                    <MapTile
                      label={layer.label}
                      selected={visible}
                      onPress={() => {
                        toggleLayer(layer.id);
                        logLayerToggle(layer.id, !visible);
                      }}
                      // Every layer draws on the same base map, so they share a
                      // palette and are told apart by the badge alone.
                      palette="basic"
                      badge={<LayerBadge layer={layer} />}
                    />
                  </View>
                );
              })}
          </View>

          {/* The event chip groups stood here. Chips filter snapshot ITEMS,
              and the map's pins now come from /map/markers/eskara26 layers that
              chips cannot reach — so they would narrow the list sheet alone
              while appearing to narrow the map. The six festival layers show up
              in the grid above on their own, because the server puts them in
              mapConfig.layers. */}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const BADGE_DOT_SIZE = 14;

/** Light enough that the map still reads as a map through the glass. */
const BACKDROP_OPACITY = 0.2;

const styles = StyleSheet.create({
  /** The card's side gap. Shared with the campus sheet's floating detents. */
  card: {
    marginHorizontal: SHEET_FLOAT_INSET,
  },
  badgeDot: {
    width: BADGE_DOT_SIZE,
    height: BADGE_DOT_SIZE,
    borderRadius: BADGE_DOT_SIZE / 2,
  },
  content: {
    padding: SdsSpacing.base,
    // Zero: the pinned header above already spaces the content off the sheet's
    // rounded top edge, and a second inset here would double it.
    paddingTop: 0,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Outside the scroll view now, so it owns the padding it used to inherit
    // from `content` — including the same max-width track, or it would run edge
    // to edge on a tablet while the grids below stayed centred.
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.base,
    paddingTop: SdsSpacing.lg,
    // Carries the gap that `sectionTitle` normally owns, so the campus grid sits
    // the same distance below its heading as the layer grid does below its own.
    paddingBottom: SdsSpacing.sm,
  },
  /** 캠퍼스 is `sectionTitle` verbatim; only the margin moves to the row. */
  headerTitle: {
    marginBottom: 0,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...SdsTypo.t5,
    fontWeight: '700',
    color: SdsColors.grey900,
    marginBottom: SdsSpacing.sm,
  },
  /**
   * Negative margin cancels the per-column gutter so the outer tiles align with
   * the section titles. Putting the gutter on the columns rather than using
   * `gap` is what lets a row be a percentage-width wrap — `gap` plus `width:
   * 25%` overflows to three-per-row.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  col: {
    width: '25%',
    paddingHorizontal: 6,
    marginBottom: SdsSpacing.sm,
  },
  badgeEmoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 17,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: SdsColors.grey200,
    marginTop: SdsSpacing.md,
    marginBottom: SdsSpacing.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reset: {
    ...SdsTypo.t7,
    fontWeight: '600',
    color: SdsColors.grey600,
    marginBottom: SdsSpacing.sm,
  },
  group: {
    marginTop: SdsSpacing.md,
  },
  groupLabel: {
    ...SdsTypo.t7,
    fontWeight: '600',
    color: SdsColors.grey600,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
