import { useCallback, useRef, useState } from 'react';
import * as Updates from 'expo-updates';

interface OTAUpdateState {
  /** Checking for available update */
  isChecking: boolean;
  /** Downloading update bundle */
  isDownloading: boolean;
  /** Update downloaded and ready to apply via reloadAsync() */
  isReadyToReload: boolean;
  /** Last error (silenced — never blocks app) */
  error: Error | null;
  /** Check for update, download if available. Does NOT reload. */
  checkAndDownload: () => Promise<boolean>;
  /** Apply downloaded update (reloads the app) */
  applyUpdate: () => Promise<void>;
}

/**
 * OTA update hook — handles check, download, and reload.
 *
 * Design:
 * - Errors are swallowed (OTA must never block app usage)
 * - No-op in __DEV__ (expo-updates disabled in dev client)
 * - Caller decides when to reload (cold start splash vs silent background)
 */
export function useOTAUpdate(): OTAUpdateState {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReadyToReload, setIsReadyToReload] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inProgress = useRef(false);

  const checkAndDownload = useCallback(async (): Promise<boolean> => {
    if (__DEV__ || inProgress.current) return false;
    inProgress.current = true;
    setError(null);

    try {
      setIsChecking(true);
      const check = await Updates.checkForUpdateAsync();
      setIsChecking(false);

      if (!check.isAvailable) {
        inProgress.current = false;
        return false;
      }

      setIsDownloading(true);
      await Updates.fetchUpdateAsync();
      setIsDownloading(false);
      setIsReadyToReload(true);
      inProgress.current = false;
      return true;
    } catch (e) {
      setIsChecking(false);
      setIsDownloading(false);
      setError(e instanceof Error ? e : new Error(String(e)));
      inProgress.current = false;
      return false;
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (__DEV__) return;
    try {
      await Updates.reloadAsync();
    } catch {
      // reloadAsync can throw if no update is ready — ignore
    }
  }, []);

  return {
    isChecking,
    isDownloading,
    isReadyToReload,
    error,
    checkAndDownload,
    applyUpdate,
  };
}
