/**
 * Building detail bottom sheet modal.
 *
 * Shows photo + header + accessibility tags + floor accordion + description + connections.
 * Opened via ref: detailSheetRef.current?.present()
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { forwardRef, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { MapTrifoldIcon } from 'phosphor-react-native';
import {
  useBuildingDetail,
  SdsColors,
  SdsSpacing,
  getLocalizedText,
  floorBadge,
  useSettingsStore,
  useT,
  type FloorSpace,
} from '@skkuverse/shared';
import { AccordionList, Badge, Gradient, ListHeader, ListRow, Txt, type AccordionSection } from '@skkuverse/sds';
import { BuildingHeader } from './BuildingHeader';
import { ConnectionsSection } from './ConnectionsSection';
import { getHsscBuildingName } from '@/features/map/hssc/data/BuildingNameMapping';
import { GLASS_AVAILABLE } from '@/components/glass';
import { GlassCardBackground } from '@/features/map/components/GlassCardBackground';
import { SheetHandle } from '@/features/map/components/SheetHandle';
import { SHEET_FLOAT_INSET } from '@/features/map/utils/sheetChrome';
import {
  logBuildingView,
  type BuildingDetailSource,
  logFloorExpand,
  logSpaceShowAll,
  logConnectionMapOpen,
  logCampusContentSelect,
} from '@/services/analytics';

interface BuildingDetailSheetProps {
  skkuId: number | null;
  highlightSpaceCd?: string;
  source?: BuildingDetailSource;
  /**
   * Gap between the card's bottom edge and the screen's, in the modal's own
   * (window) coordinates — the campus card's edge restated, so the two cards
   * sit on one line. Computed by `CampusScreen`, which measures both.
   */
  bottomGap: number;
  onConnectionTap: (targetSkkuId: number) => void;
  /** Fired by gorhom once the sheet is fully gone; the campus sheet returns on it. */
  onDismiss?: () => void;
}

/** 8px grey50 section divider */
function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

export const BuildingDetailSheet = forwardRef<
  BottomSheetModal,
  BuildingDetailSheetProps
>(function BuildingDetailSheet(
  { skkuId, highlightSpaceCd, source, bottomGap, onConnectionTap, onDismiss },
  ref,
) {
  const { data, isLoading } = useBuildingDetail(skkuId);
  const lang = useSettingsStore((s) => s.appLanguage);
  const { t, tpl } = useT();
  const router = useRouter();
  // Description expand/truncation state
  const [descExpanded, setDescExpanded] = useState(false);
  const [descNeedsMore, setDescNeedsMore] = useState(false);
  const descMeasuredRef = useRef(false);

  // Accordion state
  const initialExpanded = useMemo(() => {
    if (!highlightSpaceCd || !data) return null;
    const idx = data.floors.findIndex((f) =>
      f.spaces.some((s) => s.spaceCd === highlightSpaceCd),
    );
    return idx >= 0 ? idx : null;
  }, [data, highlightSpaceCd]);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialExpanded);
  const [showAllMap, setShowAllMap] = useState<Record<number, boolean>>({});

  // Reset all local UI state when building or highlight changes
  useEffect(() => {
    setDescExpanded(false);
    setDescNeedsMore(false);
    descMeasuredRef.current = false;
    setExpandedIndex(initialExpanded ?? null);
    setShowAllMap({});
  }, [skkuId, initialExpanded]);

  const description = data?.building.description
    ? getLocalizedText(data.building.description, lang)
    : null;

  // Re-measure description when text changes (e.g. language switch)
  useEffect(() => {
    descMeasuredRef.current = false;
    setDescNeedsMore(false);
  }, [description]);

  // Build floor badge→connection chip data (e.g. "1F" → chips with label + skkuId)
  const floorConnectionMap = useMemo(() => {
    const map = Object.create(null) as Record<
      string,
      { label: string; targetSkkuId: number }[]
    >;
    if (!data) return map;
    for (const conn of data.connections) {
      const fromFloorText = getLocalizedText(conn.fromFloor, lang);
      const fromBadge = floorBadge(fromFloorText);
      const targetName = getLocalizedText(conn.targetName, lang);
      const toFloor = getLocalizedText(conn.toFloor, lang);
      const label = `${targetName} ${floorBadge(toFloor)}`;
      if (!map[fromBadge]) map[fromBadge] = [];
      map[fromBadge].push({ label, targetSkkuId: conn.targetSkkuId });
    }
    return map;
  }, [data, lang]);

  // Convert FloorInfo[] → AccordionSection<FloorSpace>[]
  const sections: AccordionSection<FloorSpace>[] = useMemo(() => {
    if (!data) return [];
    return data.floors.map((f) => {
      const name = getLocalizedText(f.floor, lang);
      return {
        title: name,
        subtitle: tpl('building.unitCount', f.spaces.length),
        badge: floorBadge(name),
        items: f.spaces,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lang]);

  // ── Analytics: building view ──
  // NOTE: deliberately NOT calling logScreenView here. Firebase Analytics
  // treats screen_view as a stateful "current screen" — firing it from a
  // sheet would leave GA4 stuck on `building_detail_sheet` after the sheet
  // closes (the underlying /campus pathname doesn't change, so _layout's
  // dedup never re-fires `campus_screen`). Sheet-as-screen events are
  // captured via `building_view` (an action event), not screen_view.
  useEffect(() => {
    if (!data || skkuId == null) return;
    logBuildingView({
      skkuId: data.building.skkuId,
      buildingName: getLocalizedText(data.building.name, lang),
      campus: data.building.campus,
      source: source ?? 'direct',
    });
  }, [data?.building.skkuId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDescLayout = useCallback(
    (e: { nativeEvent: { lines: unknown[] } }) => {
      if (descMeasuredRef.current) return;
      descMeasuredRef.current = true;
      setDescNeedsMore(e.nativeEvent.lines.length > 3);
    },
    [],
  );

  // Check if this building exists on the HSSC floor map
  const hsscMapName = useMemo(() => {
    if (!data) return null;
    const nameKo = getLocalizedText(data.building.name, 'ko');
    return getHsscBuildingName(nameKo);
  }, [data]);

  const handleFloorMapPress = useCallback(() => {
    if (!hsscMapName) return;
    logConnectionMapOpen('hssc');
    // Dismiss sheet before navigating
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.dismiss();
    }
    router.push(`/map/hssc?building=${encodeURIComponent(hsscMapName)}` as never);
  }, [hsscMapName, ref, router]);

  // A closure rather than the component itself, because the card's bottom gap
  // is a prop here and gorhom passes a background component only its own
  // animated values.
  const renderBackground = useCallback(
    (props: BottomSheetBackgroundProps) => (
      <GlassCardBackground {...props} bottomGap={bottomGap} />
    ),
    [bottomGap],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={['85%']}
      enableDynamicSizing={false}
      // The grabber bar alone; a handle painting its own fill would be a white
      // lid across the top of the glass.
      handleComponent={SheetHandle}
      backgroundComponent={renderBackground}
      // The same floating Liquid Glass card the campus and filter sheets are,
      // by the filter sheet's route: `detached` with a `bottomInset` makes the
      // sheet body's box the visible card and stops the clipping that would
      // cut the shadow and the glass edge; the margin rides on the body so the
      // background, the handle and the content inset together. All off below
      // iOS 26. The campus sheet closes before this rises (`sheetHandoff.ts`),
      // so the card never stacks on another.
      detached={GLASS_AVAILABLE}
      bottomInset={GLASS_AVAILABLE ? bottomGap : 0}
      style={GLASS_AVAILABLE ? styles.card : undefined}
      onDismiss={onDismiss}
    >
      <BottomSheetScrollView style={styles.container}>
        {isLoading && (
          <View style={styles.loading}>
            <ActivityIndicator color={SdsColors.brand} />
          </View>
        )}

        {data && (
          <>
            <BuildingHeader building={data.building} />

            {/* ══ Section: 건물 설명 ══ */}
            {description && (
              <>
                <SectionDivider />
                <ListHeader
                  title={
                    <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                      {t('building.buildingInfo')}
                    </ListHeader.TitleParagraph>
                  }
                />
                <View style={styles.descriptionContainer}>
                  {descExpanded ? (
                    <>
                      <Txt
                        typography="t6"
                        fontWeight="regular"
                        color={SdsColors.grey700}
                      >
                        {description}
                      </Txt>
                      <Pressable
                        onPress={() => {
                          logCampusContentSelect({ content_type: 'building_desc_expand', item_id: 'collapse' });
                          setDescExpanded(false);
                        }}
                        style={styles.descToggle}
                      >
                        <Txt
                          typography="t7"
                          fontWeight="semiBold"
                          color={SdsColors.brand}
                        >
                          {t('building.collapse')}
                        </Txt>
                      </Pressable>
                    </>
                  ) : (
                    <View>
                      {/* Hidden text without numberOfLines for accurate line count */}
                      {!descMeasuredRef.current && (
                        <Txt
                          typography="t6"
                          fontWeight="regular"
                          onTextLayout={handleDescLayout}
                          style={styles.hiddenMeasure}
                        >
                          {description}
                        </Txt>
                      )}
                      <Txt
                        typography="t6"
                        fontWeight="regular"
                        color={SdsColors.grey700}
                        numberOfLines={3}
                      >
                        {description}
                      </Txt>
                      {descNeedsMore && (
                        <Pressable
                          onPress={() => {
                            logCampusContentSelect({ content_type: 'building_desc_expand', item_id: 'expand' });
                            setDescExpanded(true);
                          }}
                          style={styles.inlineMoreOverlay}
                        >
                          <Gradient.Linear
                            colors={['rgba(255,255,255,0)', SdsColors.background]}
                            degree="90deg"
                            style={styles.inlineMoreGradient}
                          />
                          <View style={styles.inlineMoreLabel}>
                            <Txt
                              typography="t6"
                              fontWeight="semiBold"
                              color={SdsColors.brand}
                            >
                              {t('building.showMore')}
                            </Txt>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* ══ Section: 층별 안내 ══ */}
            {sections.length > 0 && (
              <>
                <SectionDivider />
                <ListHeader
                  title={
                    <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                      {t('building.floorGuide')}
                    </ListHeader.TitleParagraph>
                  }
                />
                <AccordionList
                  sections={sections}
                  expandedIndex={expandedIndex}
                  onToggle={(i) => {
                    setExpandedIndex(i);
                    if (i != null && skkuId != null) {
                      const floorName = sections[i]?.title ?? '';
                      logFloorExpand(skkuId, floorName);
                    }
                  }}
                  showAllMap={showAllMap}
                  accentColor={SdsColors.brand}
                  onShowAll={(i) => {
                    setShowAllMap((prev) => ({ ...prev, [i]: true }));
                    if (skkuId != null) {
                      const floorName = sections[i]?.title ?? '';
                      logSpaceShowAll(skkuId, floorName);
                    }
                  }}
                  keyExtractor={(space) => space.spaceCd}
                  highlightKey={highlightSpaceCd}
                  renderRight={(section) => {
                    const chips = floorConnectionMap[section.badge ?? ''];
                    if (!chips) return null;
                    return (
                      <View style={styles.connChipRow}>
                        {chips.map((chip) => (
                          <Pressable
                            key={chip.targetSkkuId}
                            style={styles.connChip}
                            onPress={() => onConnectionTap(chip.targetSkkuId)}
                          >
                            <Txt typography="st12" fontWeight="medium" color={SdsColors.grey700}>
                              {'→ ' + chip.label}
                            </Txt>
                          </Pressable>
                        ))}
                      </View>
                    );
                  }}
                  renderItem={(space, _i, highlighted) => (
                    <View
                      style={[
                        styles.spaceRow,
                        highlighted && styles.spaceHighlight,
                      ]}
                    >
                      <Txt
                        typography="t7"
                        fontWeight={highlighted ? 'medium' : 'regular'}
                        color={
                          highlighted ? SdsColors.brand : SdsColors.grey700
                        }
                        style={styles.spaceName}
                      >
                        {getLocalizedText(space.name, lang)}
                      </Txt>
                      <Badge
                        size="tiny"
                        color={
                          highlighted ? SdsColors.brand : SdsColors.grey400
                        }
                        backgroundColor={
                          highlighted ? SdsColors.brandLight : SdsColors.grey100
                        }
                        style={{ minWidth: 64 }}
                      >
                        {space.spaceCd}
                      </Badge>
                    </View>
                  )}
                />
              </>
            )}

            {/* ══ Section: 연결 건물 ══ */}
            {(data.connections.length > 0 || hsscMapName) && (
              <>
                <SectionDivider />
                <ListHeader
                  title={
                    <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                      {t('building.connectedBuildings')}
                    </ListHeader.TitleParagraph>
                  }
                />
                {hsscMapName && (
                  <ListRow
                    left={
                      <View style={styles.floorMapIcon}>
                        <MapTrifoldIcon size={20} color={SdsColors.brand} />
                      </View>
                    }
                    contents={
                      <ListRow.Texts
                        type="2RowTypeE"
                        top={t('building.floorMap')}
                        bottom={t('building.floorMapDesc')}
                      />
                    }
                    withArrow
                    verticalPadding="small"
                    onPress={handleFloorMapPress}
                  />
                )}
                {data.connections.length > 0 && (
                  <ConnectionsSection
                    connections={data.connections}
                    onConnectionTap={onConnectionTap}
                  />
                )}
              </>
            )}

            <View style={styles.bottomPad} />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const DESC_LINE_HEIGHT = 22.5; // t6 lineHeight (packages/sds/src/foundation/typography.ts)
const FADE_WIDTH = 48; // gradient fade region width

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  card: { marginHorizontal: SHEET_FLOAT_INSET },
  loading: {
    padding: 40,
    alignItems: 'center',
  },
  sectionDivider: {
    height: SdsSpacing.sm,
    backgroundColor: SdsColors.grey50,
    marginTop: SdsSpacing.lg,
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  spaceHighlight: {
    backgroundColor: SdsColors.brandLight,
  },
  spaceName: {
    flex: 1,
  },
  descriptionContainer: {
    paddingHorizontal: SdsSpacing.xl,
  },
  descToggle: {
    marginTop: SdsSpacing.sm,
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
  inlineMoreOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: DESC_LINE_HEIGHT,
  },
  inlineMoreGradient: {
    width: FADE_WIDTH,
    height: DESC_LINE_HEIGHT,
  },
  inlineMoreLabel: {
    backgroundColor: SdsColors.background,
    height: DESC_LINE_HEIGHT,
    justifyContent: 'center' as const,
    paddingLeft: 2,
  },

  connChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  connChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: SdsColors.grey100,
  },
  floorMapIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SdsColors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPad: {
    height: 40,
  },
});
