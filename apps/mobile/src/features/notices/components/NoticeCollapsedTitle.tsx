import { Animated, useWindowDimensions } from 'react-native';
import { Txt } from '@skkuverse/sds';

const BAR_ITEMS_WIDTH = 208;

export function NoticeCollapsedTitle({ title, opacity }: { title: string; opacity: Animated.Value }) {
  const { width } = useWindowDimensions();
  return (
    <Animated.View style={{ opacity, maxWidth: width - BAR_ITEMS_WIDTH }}>
      <Txt typography="t6" fontWeight="bold" color="neutral" numberOfLines={1}>
        {title}
      </Txt>
    </Animated.View>
  );
}
