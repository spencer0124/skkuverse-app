import appCheck from '@react-native-firebase/app-check';
import Constants from 'expo-constants';

export async function setupAppCheck(): Promise<void> {
  const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

  // Debug-token injection for Simulator / Emulator dev builds.
  // In __DEV__, provider = 'debug'. The only reliable way to control which
  // debug token the Firebase App Check SDK sends to exchangeDebugToken is
  // to pass it via provider.configure({ debugToken }). RN Firebase internally
  // calls setenv("FIRAAppCheckDebugToken", value), which AppCheckCore reads
  // directly from NSProcessInfo.processInfo.environment. The NSUserDefaults
  // fallback (writing GACAppCheckDebugToken) is documented but does not take
  // effect on iOS Simulator under this RN Firebase / Expo prebuild combo —
  // confirmed empirically during FCM Phase 3 debugging (2026-04-22).
  const extra = Constants.expoConfig?.extra ?? {};
  const debugTokenIos = extra.firebaseAppCheckDebugTokenIos as string | undefined;
  const debugTokenAndroid = extra.firebaseAppCheckDebugTokenAndroid as string | undefined;

  provider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      ...(__DEV__ && debugTokenAndroid ? { debugToken: debugTokenAndroid } : {}),
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      ...(__DEV__ && debugTokenIos ? { debugToken: debugTokenIos } : {}),
    },
  });

  await appCheck().initializeAppCheck({
    provider,
    isTokenAutoRefreshEnabled: true,
  });
}
