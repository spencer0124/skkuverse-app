import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { SdsColors, SdsTypo, SdsSpacing, useT } from '@skkuverse/shared';
import { useAppInit } from '@/hooks/useAppInit';
import { useOTAUpdate } from '@/hooks/useOTAUpdate';

const OTA_TIMEOUT_MS = 10_000;
const BACKGROUND_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-var-requires
const splashIcon = require('../../assets/images/splash-icon.png');

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
  const [statusText, setStatusText] = useState('');
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
      setStatusText('업데이트 확인 중...');
      const hasUpdate = await ota.checkAndDownload();

      if (timedOut) return; // already moved on
      clearTimeout(timeout);

      if (hasUpdate) {
        setStatusText('업데이트 적용 중...');
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
            setPhase('ota');
            setStatusText('업데이트 적용 중...');
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

  if (phase === 'ota' || (phase === 'init' && !isReady && !error)) {
    return (
      <View style={styles.splash}>
        <Image source={splashIcon} style={styles.splashIcon} resizeMode="contain" />
        {statusText ? (
          <Text style={styles.statusText}>{statusText}</Text>
        ) : (
          <ActivityIndicator size="small" color={SdsColors.grey400} style={styles.indicator} />
        )}
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('error.appStart')}</Text>
        <Text style={styles.subtitle}>{t('error.checkNetwork')}</Text>
        {__DEV__ && error && <Text style={styles.debug}>{error}</Text>}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  splashIcon: {
    width: 200,
    height: 200,
  },
  statusText: {
    position: 'absolute',
    bottom: 80,
    fontSize: 13,
    color: SdsColors.grey400,
  },
  indicator: {
    position: 'absolute',
    bottom: 80,
  },
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
