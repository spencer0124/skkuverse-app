import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  isReady?: boolean;
  onDismiss?: () => void;
}

export function SKKUverseSplash({ isReady = false, onDismiss }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isReady) return;
    onDismiss?.();
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.root}>
      <Image
        source={require('../../assets/images/splash-icon.png')}
        style={s.icon}
        resizeMode="contain"
      />
      {/* ESKARA 축제 배너 — 축제 기간 한정 (2026-09-24). 홈 배너와 같은 이미지,
          장식이라 누를 수 없다. 축제가 끝나면 이 블록과 banner 스타일,
          useSafeAreaInsets import를 함께 걷어낸다. */}
      <View style={[s.banner, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
        <Image
          source={require('../../assets/images/eskara-banner.jpg')}
          style={s.bannerImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 160,
    height: 160,
  },
  // 화면 폭의 72%(좌우 14%씩 여백), 태블릿·가로 모드에서 커지지 않게 320 상한.
  // left/right 없이 absolute라 root의 alignItems:center로 가로 중앙 정렬된다.
  // 크기는 이 래퍼가 쥔다 — RN <Image>는 require() 에셋의 원본 크기(@1x라 2400×1251pt)를
  // style 앞에 {width, height}로 끼워 넣어서, Image에 aspectRatio만 주면 height 1251이
  // 이겨 화면을 덮는다.
  banner: {
    position: 'absolute',
    width: '72%',
    maxWidth: 320,
    aspectRatio: 2400 / 1251,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
});
