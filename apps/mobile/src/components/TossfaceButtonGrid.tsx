import { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
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

const GRID_PADDING = 16;
const GRID_GAP = 8;
const GRID_COLS = 4;
const PHONE_MAX_WIDTH = 480;

export function TossfaceButtonGrid({ items }: Props) {
  const { width: screenW } = useWindowDimensions();
  const { containerWidth, itemSize } = useMemo(() => {
    const w = Math.min(screenW, PHONE_MAX_WIDTH);
    const inner = w - GRID_PADDING * 2;
    const size = (inner - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    return { containerWidth: w, itemSize: size };
  }, [screenW]);

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.button, { width: itemSize, height: itemSize }]}
          onPress={item.onPress}
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
