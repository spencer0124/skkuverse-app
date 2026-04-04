/**
 * SDUI Button Grid — emoji + text buttons in a flexible grid.
 *
 * Each item is 77×77 with emoji on top and fitted title below.
 * Taps dispatch via `handleSduiAction`.
 *
 * Flutter source: sdui_button_grid_widget.dart + option_campus_service_button.dart
 */

import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SdsColors, type SduiButtonGrid as ButtonGridType } from '@skkuverse/shared';
import { handleSduiAction } from '../action-handler';

interface Props {
  section: ButtonGridType;
}

export function ButtonGrid({ section }: Props) {
  return (
    <View style={styles.container}>
      {section.items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.button}
          onPress={() =>
            handleSduiAction({
              actionType: item.actionType,
              actionValue: item.actionValue,
              webviewTitle: item.webviewTitle,
              webviewColor: item.webviewColor,
            })
          }
        >
          <Text style={styles.emoji}>{item.emoji}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_MARGIN = 16;
const GRID_GAP = 8;
const GRID_COLS = 4;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_MARGIN * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 8,
  },
  button: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 16,
    backgroundColor: SdsColors.grey50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
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
