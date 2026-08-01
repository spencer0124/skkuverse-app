/**
 * One-shot force-update check against GET /app/config.
 *
 * Compares the device's native version (via expo-application) with the
 * server's platform-specific `minVersion`. Fails open on any error.
 *
 * Also SEEDS THE APP-CONFIG CACHE as a side effect. The same response carries
 * `webview.bridgeOrigins` (the webview bridge allowlist) and `web.origin`, both
 * of which have to be readable synchronously from non-React code later — an
 * `onMessage` handler can't await a fetch. This call already runs at boot, so
 * keeping its result costs nothing; throwing it away (as this function used to)
 * would force a second request for data already in hand.
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import {
  safeGet,
  ApiEndpoints,
  parseAppConfig,
  setCachedAppConfig,
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
    // No cache write: the previous last-known-good stays authoritative rather
    // than being replaced by a fail-closed empty allowlist on a flaky network.
    return { required: false, updateUrl: null };
  }

  setCachedAppConfig(result.data);

  const config = result.data[platform];
  return {
    required: isVersionLessThan(appVersion, config.minVersion),
    updateUrl: config.updateUrl,
  };
}
