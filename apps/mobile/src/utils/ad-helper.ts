import { Platform } from 'react-native';
import mobileAds, { TestIds } from 'react-native-google-mobile-ads';

/** Open Ad Inspector in dev builds to verify mediation adapter status. */
export function openAdInspector() {
  if (__DEV__) {
    mobileAds().openAdInspector();
  }
}

/** AdMob banner unit IDs — debug uses Google test ads, release uses production IDs. */
export const AdUnitIds = {
  busBanner: __DEV__
    ? Platform.select({
        android: 'ca-app-pub-3940256099942544/6300978111',
        ios: 'ca-app-pub-3940256099942544/2934735716',
      })!
    : Platform.select({
        android: 'ca-app-pub-5619947536545679/9080383017',
        ios: 'ca-app-pub-5619947536545679/2519510376',
      })!,
  webviewBanner: __DEV__
    ? Platform.select({
        android: 'ca-app-pub-3940256099942544/6300978111',
        ios: 'ca-app-pub-3940256099942544/2934735716',
      })!
    : Platform.select({
        android: 'ca-app-pub-5619947536545679/6371380570',
        ios: 'ca-app-pub-5619947536545679/8997543911',
      })!,
  /**
   * 공지 상세 본문 하단(원본 페이지 열기 아래) 인라인 배너 — AdMob 콘솔 유닛명
   * `notice_banner`. 위 두 유닛과 달리 dev ID를 손으로 박지 않고 라이브러리의
   * `TestIds.ADAPTIVE_BANNER`를 쓴다: adaptive 계열은 Google이 별도 테스트 유닛을
   * 두고 있어(고정 320x50 BANNER 테스트 유닛과 다름) 가변 높이 응답을 실제와
   * 비슷하게 받아볼 수 있다. `TestIds`가 내부에서 Platform.select까지 처리한다.
   */
  noticeDetailBanner: __DEV__
    ? TestIds.ADAPTIVE_BANNER
    : Platform.select({
        android: 'ca-app-pub-5619947536545679/5214084608',
        ios: 'ca-app-pub-5619947536545679/1948792861',
      })!,
} as const;
