import { useT } from '@skkuverse/shared';
import { DrainButton } from './DrainButton';

export const REVIVE_WINDOW_MS = 10_000;

interface Props {
  /** The offer's state for this crash (host/domain `Offer`). */
  offer: 'open' | 'watching' | 'closed';
  /** An ad is loaded and the offer is open. */
  enabled: boolean;
  adLoading: boolean;
  /** Hold the countdown (the app is in the background, or a sheet is over the game). */
  paused: boolean;
  onRevive(): void;
  onExpire(): void;
}

/**
 * The chance to continue: a button whose colour drains away in ten seconds. When it runs out the button is spent and
 * the run is final; the player never has to decline it.
 */
export function ReviveOffer({ offer, enabled, adLoading, paused, onRevive, onExpire }: Props) {
  const { t } = useT();
  return (
    <DrainButton
      label={t('game.revive')}
      durationMs={REVIVE_WINDOW_MS}
      running={offer === 'open' && !paused}
      done={offer === 'closed'}
      enabled={enabled}
      busy={offer === 'watching' || (offer === 'open' && adLoading)}
      onPress={onRevive}
      onExpire={onExpire}
    />
  );
}
