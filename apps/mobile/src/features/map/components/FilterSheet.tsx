/**
 * Filter bottom sheet — the full filter surface.
 *
 * Everything here comes from `/map/config`: the campus pills and one tile per
 * user-configurable layer, festival layers included. The server serves those
 * as ordinary layers while an activation is open, so they appear in the grid
 * without this file knowing a festival exists — and hiding one here is the
 * same write a chip makes, read back by the same `isLayerVisible`.
 *
 * No sort control. Sort is only observable in the list, so a selector here would
 * be a control that appears to do nothing — see `EventListPanel`.
 *
 * Campus and layer are thumbnail tiles rather than text pills. A pill row states
 * what a layer is called; a tile shows what turning it on does to the map, which
 * is the actual question.
 *
 * On iOS 26 the sheet is a floating Liquid Glass card rather than a panel
 * welded to the screen edges, matching the campus sheet behind it. That is all
 * `surface="glass"` plus a `medium` detent — `Sheet` resolves a glass sheet that
 * never reaches `large` to gorhom's own `detached` card, with no interpolation.
 */

import { forwardRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { toCssColor } from '../utils/toCssColor';
import { Sheet, SheetCloseButton, type SheetRef } from '@skkuverse/sds';
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
  /**
   * The clock a layer's schedule is read against.
   *
   * Passed down rather than taken from a second `useWindowClock` here, so a tile
   * and the map behind it cannot land on opposite sides of 18:00 and disagree
   * about whether 주점 is on — which is exactly the drift `isLayerVisible` was
   * extracted to prevent, arriving through a different door.
   */
  now: number;
}

export const FilterSheet = forwardRef<SheetRef, FilterSheetProps>(
  function FilterSheet({ mapConfig, bottomGap, now }, ref) {
    const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
    const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);
    const overrides = useMapLayerStore((s) => s.overrides);
    const activeChip = useMapLayerStore((s) => s.chip);
    const setLayerOverride = useMapLayerStore((s) => s.setLayerOverride);

    const layerState = useMemo(
      () => ({ overrides, chip: activeChip }),
      [overrides, activeChip],
    );

    const handleCampusPress = useCallback(
      (campusId: Campus) => {
        setSelectedCampus(campusId);
      },
      [setSelectedCampus],
    );

    const { t } = useT();

    return (
      <Sheet
        ref={ref}
        // `medium` rather than a percentage: the sheet no longer moves, so a
        // second detent would be dead config that reads as a feature.
        position={{ kind: 'stuck', detent: 'medium' }}
        surface="glass"
        // No dragging by handle or by content, and so no grabber. Dragging the
        // content is what would otherwise fight the grid: a downward swipe
        // meant to scroll to the layers would instead pull the sheet shut. The
        // X and the backdrop are how it closes.
        dismissible={false}
        // Tap-outside-to-close. `Sheet` dims a glass card far less than a solid
        // one, because glass samples whatever is behind it and a half-black
        // scrim over the map would turn the card into a grey panel.
        backdrop
        bottomGap={bottomGap}
        // It can be opened while the peek sheet is up, and the default 'switch'
        // would minimise that sheet and resurface it on close.
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
        <Sheet.ScrollView
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
                const visible = isLayerVisible(layer, layerState, now);
                return (
                  <View key={layer.id} style={styles.col}>
                    <MapTile
                      label={layer.label}
                      selected={visible}
                      onPress={() => {
                        // The target, not a flip. The store holds only what the
                        // user expressed, so it cannot resolve the current value
                        // itself without being handed `now` and the layer list —
                        // and this tile has already resolved it, one line up.
                        setLayerOverride(layer.id, !visible);
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
        </Sheet.ScrollView>
      </Sheet>
    );
  },
);

const BADGE_DOT_SIZE = 14;

const styles = StyleSheet.create({
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
});
