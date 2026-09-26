import { useCallback, useEffect, useRef, useState } from 'react';
import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { logHandledError } from '@/services/crashlytics';

/** `off`: the game has no revives, so no ad is ever loaded. */
export type RewardedStatus = 'loading' | 'ready' | 'failed' | 'off';

/**
 * One rewarded ad kept loaded for the next revive. `show()` resolves true
 * only when the ad reported the reward and then closed — closing early earns
 * nothing — and a fresh ad starts loading behind it either way.
 */
export function useRewardedRevive(unitId: string, enabled: boolean) {
  const adRef = useRef<RewardedAd | null>(null);
  const detachRef = useRef<() => void>(() => {});
  const showingRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<RewardedStatus>(enabled ? 'loading' : 'off');

  const load = useCallback(() => {
    if (!enabled) return;
    detachRef.current();
    const ad = RewardedAd.createForAdRequest(unitId);
    adRef.current = ad;
    setStatus('loading');
    const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setStatus('ready'));
    const offError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      logHandledError('games/rewarded-load', error);
      setStatus('failed');
    });
    detachRef.current = () => {
      offLoaded();
      offError();
    };
    ad.load();
  }, [unitId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      detachRef.current();
    };
  }, [load]);

  const show = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const ad = adRef.current;
        if (!ad || status !== 'ready' || showingRef.current) {
          resolve(false);
          return;
        }
        showingRef.current = true;
        detachRef.current();
        let earned = false;
        const offs: (() => void)[] = [];
        const finish = (ok: boolean) => {
          offs.forEach((off) => off());
          showingRef.current = false;
          resolve(ok);
          if (mountedRef.current) load();
        };
        detachRef.current = () => offs.forEach((off) => off());
        offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => (earned = true)));
        offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)));
        offs.push(
          ad.addAdEventListener(AdEventType.ERROR, (error) => {
            logHandledError('games/rewarded-show', error);
            finish(false);
          }),
        );
        ad.show().catch((error) => {
          logHandledError('games/rewarded-show', error);
          finish(false);
        });
      }),
    [status, load],
  );

  return { status, show, reload: load };
}
