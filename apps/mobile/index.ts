/**
 * Custom entry point — registers the FCM background message handler
 * BEFORE expo-router/entry calls AppRegistry.registerComponent.
 *
 * Without this, Android quit-state background messages silently fail
 * because the handler isn't registered early enough.
 * See: https://github.com/invertase/react-native-firebase/discussions/7609
 *
 * The notifee background event handler has the same requirement and the same
 * reason: it must exist before any notification can be interacted with, and
 * notifee warns at runtime if the app is launched from one without it.
 */
import messaging from '@react-native-firebase/messaging';
import { backgroundMessageHandler } from './src/services/background-messaging';
import { registerBackgroundNotificationEvents } from './src/services/background-notification-events';

messaging().setBackgroundMessageHandler(backgroundMessageHandler);
registerBackgroundNotificationEvents();

// Expo Router default entry.
//
// Its position here is conventional, NOT load-bearing: Babel's CommonJS
// transform hoists every import's require() above the module body, so
// `require("expo-router/entry")` is evaluated before both calls above no matter
// where this line sits. Verified against this repo's own babel-preset-expo.
// That is harmless — expo-router/entry only hands AppRegistry a component
// factory, and the bundle finishes executing before any task is dispatched, so
// both handlers are registered by the time either can fire.
//
// What actually matters is that the registrations happen at MODULE SCOPE in the
// entry file at all, rather than inside a component. Moving either into React
// is the failure the header describes.
// eslint-disable-next-line import/first
import 'expo-router/entry';
