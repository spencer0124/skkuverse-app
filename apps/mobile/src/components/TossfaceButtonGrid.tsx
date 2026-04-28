import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SdsColors } from '@skkuverse/shared';

export interface TossfaceGridItem {
  id: string;
  title: string;
  emoji: string;
  onPress: () => void;
}

interface Props {
  items: readonly TossfaceGridItem[];
}

export function TossfaceButtonGrid({ items }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item) => (
        <Pressable key={item.id} style={styles.button} onPress={item.onPress}>
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
    marginHorizontal: GRID_MARGIN,
    gap: GRID_GAP,
  },
  button: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 16,
    backgroundColor: '#fff',
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
