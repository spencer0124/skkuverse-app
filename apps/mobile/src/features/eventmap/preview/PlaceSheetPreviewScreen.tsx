/**
 * Development screen: every kind of festival place, one tap from its sheet.
 *
 * Reached from the settings screen's development menu, and only in a
 * development build — `usePlaceDetail` serves its mock under `__DEV__` alone,
 * so anywhere else this would list places whose sheets are all base skeletons.
 *
 * It mounts the real `EventMapPeekSheet`, with the same dismiss-and-return
 * round trip `CampusScreen` wires, so what is checked here is what the map
 * shows. A pushed screen rather than a modal one: the sheet is portalled above
 * the root navigator, and a natively presented modal would cover it.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { festivalDaysOf, pickI18nText, SdsColors, SdsSpacing } from '@skkuverse/shared';
import {
  ListRow,
  SegmentedControl,
  SHEET_FLOAT_INSET,
  Txt,
  type SheetRef,
} from '@skkuverse/sds';
import { EventMapPeekSheet } from '../EventMapPeekSheet';
import { previewPlaces, type PreviewClock } from './mockOverlays';

const CLOCKS: { value: PreviewClock; label: string }[] = [
  { value: 'open', label: '운영 중' },
  { value: 'upcoming', label: '오픈 전' },
  { value: 'closed', label: '종료' },
];

export function PlaceSheetPreviewScreen() {
  const insets = useSafeAreaInsets();
  const [clock, setClock] = useState<PreviewClock>('open');
  const [now] = useState(() => Date.now());
  const places = useMemo(() => previewPlaces(clock, now), [clock, now]);
  const festivalDays = useMemo(() => festivalDaysOf(places.map((p) => p.overlay)), [places]);

  const sheetRef = useRef<SheetRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = places.find((p) => p.overlay.id === selectedId)?.overlay ?? null;

  // The same two-flag round trip as CampusScreen: a button dismisses the sheet
  // to navigate, and the sheet comes back when this screen is focused again.
  const dismissedToNavigate = useRef(false);
  const restoreOnFocus = useRef(false);
  const onNavigateAway = useCallback(() => {
    dismissedToNavigate.current = true;
    restoreOnFocus.current = true;
  }, []);
  const onDismiss = useCallback(() => {
    if (dismissedToNavigate.current) {
      dismissedToNavigate.current = false;
      return;
    }
    setSelectedId(null);
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!restoreOnFocus.current) return;
      restoreOnFocus.current = false;
      sheetRef.current?.present?.();
    }, []),
  );

  const open = useCallback((id: string) => {
    setSelectedId(id);
    sheetRef.current?.present?.();
  }, []);

  return (
    <View style={styles.root}>
      <FlatList
        data={places}
        keyExtractor={(p) => p.overlay.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SdsSpacing.xl }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt typography="t7" color={SdsColors.grey600}>
              목 데이터는 개발 빌드에서만 연결돼요. 시각을 바꾸면 운영 상태가 바뀌어요.
            </Txt>
            <SegmentedControl value={clock} onValueChange={(v) => setClock(v as PreviewClock)}>
              {CLOCKS.map((c) => (
                <SegmentedControl.Item key={c.value} value={c.value}>
                  {c.label}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl>
          </View>
        }
        renderItem={({ item }) => (
          <ListRow
            verticalPadding="small"
            withArrow
            onPress={() => open(item.overlay.id)}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={pickI18nText(item.overlay.text, 'ko')}
                bottom={item.note}
              />
            }
          />
        )}
      />

      <EventMapPeekSheet
        ref={sheetRef}
        place={selected}
        now={now}
        festivalDays={festivalDays}
        bottomGap={insets.bottom + SHEET_FLOAT_INSET}
        onDismiss={onDismiss}
        onNavigateAway={onNavigateAway}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SdsColors.background },
  header: { gap: SdsSpacing.md, padding: SdsSpacing.xl },
});
