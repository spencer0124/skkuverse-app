import { useCallback, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  useForeground,
} from 'react-native-google-mobile-ads';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

/**
 * "광고" 라벨이 차지하는 높이(dp). 슬롯 전체 높이는 `maxHeight`로 고정이므로
 * 배너에 요청하는 높이에서 이만큼을 빼야 라벨+배너가 슬롯 안에 들어간다.
 * 빼지 않으면 소재가 상한까지 꽉 찬 날 라벨이 슬롯 밖으로 밀린다.
 */
const AD_LABEL_HEIGHT = 18;

interface Props {
  unitId: string;
  /**
   * 인라인 adaptive 배너의 높이 상한(dp). 지정하지 않으면 SDK 기본값이
   * **기기 화면 높이**라 광고가 화면을 통째로 먹을 수 있다
   * (`GADCurrentOrientationInlineAdaptiveBannerAdSizeWithWidth` /
   * `AdSize.getCurrentOrientationInlineAdaptiveBannerAdSize`). 항상 넘길 것.
   *
   * 이 값은 동시에 **로드 전 예약 높이**이기도 하다 — 아래 슬롯 정책 참고.
   */
  maxHeight?: number;
}

/**
 * 스크롤 콘텐츠 **중간**에 끼워 넣는 인라인 adaptive 배너.
 *
 * 하단 고정 바인 `AdaptiveBanner`와 다른 점:
 *
 * 1. **컨테이너 실측 폭을 `width`로 넘긴다.** 네이티브는 adaptive 사이즈를 계산할 때
 *    부모 뷰가 아니라 **화면 폭**을 기준으로 삼는다(`RNGoogleMobileAdsCommon.mm:212`,
 *    `ReactNativeGoogleMobileAdsCommon.java:59`). 좌우 패딩이 있는 컨테이너에
 *    그냥 넣으면 화면 폭짜리 광고를 요청해 슬롯 밖으로 잘려 나간다 —
 *    잘린 광고는 AdMob 정책 위반이기도 하다. onLayout으로 실제 폭을 재서
 *    넘기고, 폭이 0인 첫 프레임에는 아예 요청을 걸지 않는다.
 * 2. **`maxHeight`만큼 슬롯을 미리 예약한다.** 본문 위에 놓이므로, 로드가 끝난 뒤
 *    높이가 생기면 읽고 있던 본문이 통째로 아래로 밀린다. 그래서 처음부터 슬롯을
 *    잡아두고 광고는 그 안에서 페이드인만 시킨다. 실제 소재가 상한보다 낮게 와도
 *    슬롯은 줄이지 않는다 — 줄이는 것 자체가 또 한 번의 시프트다.
 *    **예외는 로드 실패**: no-fill은 흔한데 본문 한가운데 빈 250dp를 영구히
 *    남길 수는 없어서 이때만 0으로 접는다(위로 한 번 당겨짐).
 */
export function InlineBanner({ unitId, maxHeight = 250 }: Props) {
  const { t } = useT();
  const bannerRef = useRef<BannerAd>(null);
  const [width, setWidth] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  // iOS: 백그라운드 복귀 시 재요청 (AdaptiveBanner와 동일 정책)
  useForeground(() => {
    Platform.OS === 'ios' && bannerRef.current?.load();
  });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    // 소수점 폭을 그대로 넘기면 네이티브가 올림 처리하며 1dp 초과할 수 있어 내림.
    const next = Math.floor(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  if (collapsed) return null;

  return (
    <View
      style={{ height: maxHeight, alignItems: 'center', justifyContent: 'center' }}
      onLayout={handleLayout}
    >
      {width > 0 ? (
        /* 라벨은 배너와 **같은 opacity**를 탄다. 따로 항상 띄우면 로드 전
           예약된 빈 슬롯 위에 "광고"만 떠 있게 되고, no-fill로 접힐 때는
           라벨만 남는 유령이 된다. 함께 페이드인해야 둘의 수명이 같다.
           위치는 배너 **바로 위 왼쪽** — AdMob이 허용하는 관행적 자리다.
           소재 위에 겹치면 광고를 가리는 게 되어 오히려 정책 위반이다. */
        <Animated.View style={{ opacity, width }}>
          <Txt
            typography="st12"
            color={SdsColors.grey500}
            style={{ height: AD_LABEL_HEIGHT }}
          >
            {t('common.adLabel')}
          </Txt>
          <BannerAd
            ref={bannerRef}
            unitId={unitId}
            size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
            width={width}
            maxHeight={maxHeight - AD_LABEL_HEIGHT}
            onAdLoaded={(dimensions) => {
              if (__DEV__) console.log('[AdMob] Inline loaded:', unitId, dimensions);
              setCollapsed(false);
              Animated.timing(opacity, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              }).start();
            }}
            onAdFailedToLoad={(error) => {
              if (__DEV__) console.log('[AdMob] Inline failed:', unitId, error.message);
              setCollapsed(true);
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
