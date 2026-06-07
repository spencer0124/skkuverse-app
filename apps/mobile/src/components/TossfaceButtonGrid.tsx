import { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SdsColors } from '@skkuverse/shared';

export interface TossfaceGridItem {
  id: string;
  title: string;
  /** Tossface 이모지 — imageSource가 없을 때 렌더. */
  emoji?: string;
  /** 로컬 require() 이미지 — 제공 시 이모지 대신 표시. */
  imageSource?: number;
  onPress: () => void;
  /** When true, renders a small red "N" badge at the top-right of the tile. */
  isNew?: boolean;
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
          {item.imageSource ? (
            <Image
              source={item.imageSource}
              style={styles.tileImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.emoji}>{item.emoji}</Text>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {item.isNew ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>N</Text>
            </View>
          ) : null}
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
  tileImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: SdsColors.grey800,
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F04452',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 12,
    letterSpacing: -0.2,
  },
});
