/**
 * Custom entry point — registers the FCM background message handler
 * BEFORE expo-router/entry calls AppRegistry.registerComponent.
 *
 * Without this, Android quit-state background messages silently fail
 * because the handler isn't registered early enough.
 * See: https://github.com/invertase/react-native-firebase/discussions/7609
 */
import messaging from '@react-native-firebase/messaging';
import { backgroundMessageHandler } from './src/services/background-messaging';

messaging().setBackgroundMessageHandler(backgroundMessageHandler);

// Expo Router default entry — must come after handler registration.
// Hoisting this to the top would register the component before
// setBackgroundMessageHandler runs, which is the exact failure the file
// header describes, so the rule is suppressed rather than satisfied.
// eslint-disable-next-line import/first
import 'expo-router/entry';
