/**
 * SDUI Button Grid — emoji + text buttons in an N-column grid.
 *
 * Sizes itself from its PARENT, never from the window. The campus sheet's card
 * is inset from the screen and that inset animates 8→0 as the sheet rises, so a
 * width derived from `useWindowDimensions` overflows the card at every detent
 * and by a different amount at each one. Rows of `flex: 1` tiles need no
 * measurement at all — flexbox divides whatever width arrives, on every frame,
 * for free. `aspectRatio` keeps them square for the same reason.
 *
 * `section.columns` is honoured rather than assumed to be four. The parser
 * already defaults it, so a server that ships a three-column group gets one.
 *
 * Flutter source: sdui_button_grid_widget.dart + option_campus_service_button.dart
 */

import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SdsColors, type SduiButtonGrid as ButtonGridType } from '@skkuverse/shared';
import { handleSduiAction } from '../action-handler';
import { logSduiContentSelect } from '@/services/analytics';

interface Props {
  section: ButtonGridType;
}

const GRID_GAP = 8;

/**
 * Stops the tiles growing to absurd squares on a tablet. A cap, not a width:
 * the grid still takes less when the card gives it less.
 */
const GRID_MAX_WIDTH = 480;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export function ButtonGrid({ section }: Props) {
  const columns = Math.max(1, section.columns);
  const rows = useMemo(() => chunk(section.items, columns), [section.items, columns]);

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View key={row[0]?.id ?? rowIndex} style={styles.row}>
          {row.map((item) => (
            <Pressable
              key={item.id}
              style={styles.button}
              onPress={() => {
                logSduiContentSelect({ content_type: 'button_grid_item', item_id: item.id });
                handleSduiAction({
                  actionType: item.actionType,
                  actionValue: item.actionValue,
                  webviewTitle: item.webviewTitle,
                  webviewColor: item.webviewColor,
                });
              }}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          ))}
          {/* A short final row must keep the column width of a full one, or
              three items stretch to fill four columns' worth of space. */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`filler-${i}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: GRID_MAX_WIDTH,
    alignSelf: 'center',
    gap: GRID_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: SdsColors.grey50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
  },
  filler: {
    flex: 1,
  },
  emoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 26,
    lineHeight: 32,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: SdsColors.grey800,
  },
});
