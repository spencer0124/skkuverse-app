/**
 * SDUI Button Grid — emoji + text buttons in a flexible grid.
 *
 * Each item is 77×77 with emoji on top and fitted title below.
 * Taps dispatch via `handleSduiAction`.
 *
 * Flutter source: sdui_button_grid_widget.dart + option_campus_service_button.dart
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SdsColors, SdsRadius, type SduiButtonGrid as ButtonGridType } from '@skkuuniverse/shared';
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
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const BUTTON_SIZE = 77;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 8,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.grey100,
    borderRadius: SdsRadius.md,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
  },
  emoji: {
    fontSize: 30,
    lineHeight: 30,
    height: 30,
  },
  title: {
    marginTop: 5,
    fontSize: 12,
    color: SdsColors.grey900,
  },
});
