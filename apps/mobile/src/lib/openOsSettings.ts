import { Linking, Platform } from 'react-native';

export async function openOsSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch (e) {
    if (__DEV__) console.warn('[lib] openOsSettings failed:', e);
  }
}
