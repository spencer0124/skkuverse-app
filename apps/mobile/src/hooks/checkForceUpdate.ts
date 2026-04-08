/**
 * One-shot force-update check against GET /app/config.
 *
 * Compares the device's native version (via expo-application) with the
 * server's platform-specific `minVersion`. Fails open on any error.
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import {
  safeGet,
  ApiEndpoints,
  parseAppConfig,
  isVersionLessThan,
} from '@skkuverse/shared';

export interface ForceUpdateResult {
  required: boolean;
  updateUrl: string | null;
}

export async function checkForceUpdate(): Promise<ForceUpdateResult> {
  const appVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  const result = await safeGet(ApiEndpoints.appConfig(), parseAppConfig, {
    timeout: 5_000,
  });

  if (!result.ok) {
    return { required: false, updateUrl: null };
  }

  const config = result.data[platform];
  return {
    required: isVersionLessThan(appVersion, config.minVersion),
    updateUrl: config.updateUrl,
  };
}
