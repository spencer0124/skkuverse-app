import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Txt } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import type { StageProps } from '../registry';
import { PauseCard } from '../host/stage/PauseCard';
import { StageTitle } from '../host/stage/StageTitle';

/** Must match GROUND_RATIO in packages/wave-run/src/game/render/layout.ts: the sky sits above it. */
const GROUND_RATIO = 0.58;

/** The title sits on the daytime sky (pale), the controls on the field (green). */
const SKY_INK = '#073E32';
const SKY_SOFT = 'rgba(7,62,50,0.72)';
const INK = '#FFFFFF';

/**
 * What the canvas does not draw: the title before the first run, the controls
 * as a run starts, and the pause card. It never takes a touch — every press
 * belongs to the page underneath.
 */
export function WaveRunOverlay({ phase, showControls }: StageProps) {
  const { t } = useT();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {phase === 'ready' && (
        <View style={styles.sky}>
          <StageTitle title={t('game.waveRun.title')} sub={t('game.waveRun.sub')} ink={SKY_INK} softInk={SKY_SOFT} />
        </View>
      )}

      {phase === 'paused' && (
        <View style={styles.sky}>
          <PauseCard title={t('game.paused')} sub={t('game.waveRun.pausedSub')} ink={SKY_INK} softInk="#3C5A52" />
        </View>
      )}

      {(phase === 'ready' || (phase === 'running' && showControls)) && (
        <View style={styles.field}>
          <View style={styles.controls}>
            <Zone keyLabel={t('game.waveRun.controls.duckKey')} text={t('game.waveRun.controls.duck')} />
            <View style={styles.divider} />
            <Zone keyLabel={t('game.waveRun.controls.jumpKey')} text={t('game.waveRun.controls.jump')} />
          </View>
          {phase === 'ready' && <StartPrompt text={t('game.waveRun.tapToStart')} />}
        </View>
      )}
    </View>
  );
}

/** "Tap to start", swelling and easing back until the first press. */
function StartPrompt({ text }: { text: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [scale]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.start, pulse]}>
      <Txt typography="t6" fontWeight="bold" color={INK}>
        {text}
      </Txt>
    </Animated.View>
  );
}

function Zone({ keyLabel, text }: { keyLabel: string; text: string }) {
  return (
    <View style={styles.zone}>
      <View style={styles.key}>
        <Txt typography="t7" fontWeight="bold" color={SKY_INK}>
          {keyLabel}
        </Txt>
      </View>
      <Txt typography="t7" color={INK} style={styles.zoneText}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `${GROUND_RATIO * 100}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  field: {
    position: 'absolute',
    top: `${GROUND_RATIO * 100}%`,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    // Near the ground line, clear of the crowd the page draws in the field's lower half.
    justifyContent: 'flex-start',
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  controls: { flexDirection: 'row', alignItems: 'stretch' },
  zone: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  key: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  zoneText: { textAlign: 'center' },
  start: { marginTop: 20 },
});
