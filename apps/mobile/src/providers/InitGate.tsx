import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SdsColors, SdsTypo, SdsSpacing, useT } from '@skkuverse/shared';
import { useAppInit } from '@/hooks/useAppInit';
import { useOTAUpdate } from '@/hooks/useOTAUpdate';
import { SKKUverseSplash } from './SKKUverseSplash';

const OTA_TIMEOUT_MS = 10_000;
const BACKGROUND_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type Phase = 'ota' | 'init' | 'ready' | 'error';

/**
 * Init gate — OTA update check → app initialization → render children.
 *
 * Cold start flow:
 *   Custom splash (OTA check) → download if available → reloadAsync() or proceed
 *
 * Resume flow (5min+ background):
 *   Show splash → OTA check → reloadAsync() or proceed
 *
 * Resume flow (<5min background):
 *   Silent download only, no splash
 */
export function InitGate({ children }: { children: ReactNode }) {
  const { isReady, error } = useAppInit();
  const { t } = useT();
  const ota = useOTAUpdate();

  const [phase, setPhase] = useState<Phase>('ota');
  const [showSplash, setShowSplash] = useState(true);
  const backgroundAt = useRef<number>(0);
  const otaDone = useRef(false);

  // ── Cold start OTA check ──
  useEffect(() => {
    if (otaDone.current) return;
    otaDone.current = true;

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      setPhase('init');
    }, OTA_TIMEOUT_MS);

    (async () => {
      const hasUpdate = await ota.checkAndDownload();

      if (timedOut) return; // already moved on
      clearTimeout(timeout);

      if (hasUpdate) {
        await ota.applyUpdate(); // reloads app — won't return
      }

      setPhase('init');
    })();

    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume: track background duration ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundAt.current = Date.now();
      }

      if (state === 'active' && backgroundAt.current > 0) {
        const elapsed = Date.now() - backgroundAt.current;
        backgroundAt.current = 0;
        const longBackground = elapsed >= BACKGROUND_THRESHOLD_MS;

        // Always check silently first (no splash)
        (async () => {
          const hasUpdate = await ota.checkAndDownload();
          if (!hasUpdate) return;

          if (longBackground) {
            // 5min+ → show splash overlay → download already done → reload
            setShowSplash(true);
            setPhase('ota');
            await ota.applyUpdate();
          }
          // 5min- → download done, apply on next cold start or 5min+ resume
        })();
      }
    });

    return () => sub.remove();
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Transition from init → ready/error when useAppInit resolves ──
  useEffect(() => {
    if (phase !== 'init') return;
    if (error) setPhase('error');
    else if (isReady) setPhase('ready');
  }, [phase, isReady, error]);

  // ── Render ──

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('error.appStart')}</Text>
        <Text style={styles.subtitle}>{t('error.checkNetwork')}</Text>
        {__DEV__ && error && <Text style={styles.debug}>{error}</Text>}
      </View>
    );
  }

  return (
    <>
      {children}
      {showSplash && (
        <SKKUverseSplash
          isReady={phase === 'ready'}
          onDismiss={() => setShowSplash(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SdsColors.grey50,
    padding: SdsSpacing.xl,
  },
  title: {
    fontFamily: SdsTypo.t4.fontFamily,
    fontSize: SdsTypo.t4.fontSize,
    lineHeight: SdsTypo.t4.lineHeight,
    fontWeight: SdsTypo.t4.fontWeight,
    color: SdsColors.grey900,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: SdsTypo.t6.fontFamily,
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: SdsTypo.t6.fontWeight,
    color: SdsColors.grey500,
    textAlign: 'center',
    marginTop: SdsSpacing.sm,
  },
  debug: {
    fontFamily: SdsTypo.t7.fontFamily,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: SdsTypo.t7.fontWeight,
    color: SdsColors.red500,
    textAlign: 'center',
    marginTop: SdsSpacing.base,
  },
});
