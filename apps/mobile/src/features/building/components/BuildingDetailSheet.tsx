/**
 * Building detail bottom sheet modal.
 *
 * Shows photo + header + accessibility tags + floor accordion + connections.
 * Opened via ref: detailSheetRef.current?.present()
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { forwardRef, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {
  useBuildingDetail,
  SdsColors,
  SdsSpacing,
  SdsTypo,
  getLocalizedText,
  useSettingsStore,
  type FloorSpace,
} from '@skkuuniverse/shared';
import { AccordionList, Badge, Txt, type AccordionSection } from '@skkuuniverse/sds';
import { BuildingHeader } from './BuildingHeader';
import { ConnectionsSection } from './ConnectionsSection';

interface BuildingDetailSheetProps {
  skkuId: number | null;
  highlightSpaceCd?: string;
  onConnectionTap: (targetSkkuId: number) => void;
}

/** Convert Korean floor name to short badge code: "1층" → "1F", "지하 2층" → "B2" */
function floorBadge(name: string): string {
  const basement = name.match(/지하\s*(\d+)/);
  if (basement) return `B${basement[1]}`;
  const num = name.match(/(\d+)/);
  if (num) return `${num[1]}F`;
  return name.length > 3 ? name.substring(0, 3) : name;
}

export const BuildingDetailSheet = forwardRef<
  BottomSheetModal,
  BuildingDetailSheetProps
>(function BuildingDetailSheet({ skkuId, highlightSpaceCd, onConnectionTap }, ref) {
  const { data, isLoading } = useBuildingDetail(skkuId);
  const lang = useSettingsStore((s) => s.appLanguage);

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

  // Convert FloorInfo[] → AccordionSection<FloorSpace>[]
  const sections: AccordionSection<FloorSpace>[] = useMemo(() => {
    if (!data) return [];
    return data.floors.map((f) => {
      const name = getLocalizedText(f.floor, lang);
      return {
        title: name,
        badge: floorBadge(name),
        subtitle: `호실 ${f.spaces.length}개`,
        items: f.spaces,
      };
    });
  }, [data, lang]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={['55%', '85%']}
      enableDynamicSizing={false}
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

            {sections.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>층별 안내</Text>
                <AccordionList
                  sections={sections}
                  expandedIndex={expandedIndex}
                  onToggle={setExpandedIndex}
                  showAllMap={showAllMap}
                  onShowAll={(i) =>
                    setShowAllMap((prev) => ({ ...prev, [i]: true }))
                  }
                  keyExtractor={(space) => space.spaceCd}
                  highlightKey={highlightSpaceCd}
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
                          highlighted ? SdsColors.blue500 : SdsColors.grey700
                        }
                        style={styles.spaceName}
                      >
                        {getLocalizedText(space.name, lang)}
                      </Txt>
                      <Badge
                        size="tiny"
                        color={
                          highlighted ? SdsColors.blue500 : SdsColors.grey400
                        }
                        backgroundColor={
                          highlighted ? SdsColors.blue50 : SdsColors.grey100
                        }
                      >
                        {space.spaceCd}
                      </Badge>
                    </View>
                  )}
                />
              </View>
            )}

            <ConnectionsSection
              connections={data.connections}
              onConnectionTap={onConnectionTap}
            />

            <View style={styles.bottomPad} />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    padding: 40,
    alignItems: 'center',
  },
  section: {
    paddingTop: SdsSpacing.md,
  },
  sectionTitle: {
    ...SdsTypo.t5,
    fontWeight: '700',
    color: SdsColors.grey900,
    paddingHorizontal: SdsSpacing.base,
    marginBottom: SdsSpacing.xs,
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  spaceHighlight: {
    backgroundColor: SdsColors.blue50,
  },
  spaceName: {
    flex: 1,
  },
  bottomPad: {
    height: 40,
  },
});
