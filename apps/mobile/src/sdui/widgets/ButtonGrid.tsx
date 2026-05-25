/**
 * SDUI Button Grid — emoji + text buttons in a flexible grid.
 *
 * Each item is 77×77 with emoji on top and fitted title below.
 * Taps dispatch via `handleSduiAction`.
 *
 * Flutter source: sdui_button_grid_widget.dart + option_campus_service_button.dart
 */

import { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SdsColors, type SduiButtonGrid as ButtonGridType } from '@skkuverse/shared';
import { handleSduiAction } from '../action-handler';
import { logSduiContentSelect } from '@/services/analytics';

interface Props {
  section: ButtonGridType;
}

const GRID_PADDING = 16;
const GRID_GAP = 8;
const GRID_COLS = 4;
const PHONE_MAX_WIDTH = 480;

export function ButtonGrid({ section }: Props) {
  const { width: screenW } = useWindowDimensions();
  const { containerWidth, itemSize } = useMemo(() => {
    const w = Math.min(screenW, PHONE_MAX_WIDTH);
    const inner = w - GRID_PADDING * 2;
    const size = (inner - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    return { containerWidth: w, itemSize: size };
  }, [screenW]);

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {section.items.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.button, { width: itemSize, height: itemSize }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
    alignSelf: 'center',
  },
  button: {
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
