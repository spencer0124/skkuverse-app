import { Platform } from 'react-native';

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
} as const;
