import type { ComponentType } from 'react';
import type { GameStats } from '@skkuverse/game-host';
import type { TranslationKey } from '@skkuverse/shared';
import { BACKGROUND as SUBWAY_TYPING_BACKGROUND, formatTime } from '@skkuverse/subway-typing';
import type { GameOver, SessionState } from './host/domain';
import type { NativeGameId } from './ids';
import type { ScoreOrder } from './leaderboard/domain';
import { WAVE_RUN_HTML } from './wave-run/html.generated';
import { WaveRunOverlay } from './wave-run/Overlay';
import { SUBWAY_TYPING_HTML } from './subway-typing/html.generated';
import { SubwayTypingOverlay } from './subway-typing/Overlay';

export type Translate = (key: TranslationKey, ...args: (string | number)[]) => string;

/** What a game's native overlay is told: where the run stands, and the device best. */
export interface StageProps {
  phase: SessionState['phase'];
  /** The device best, 0 when there is none. */
  hi: number;
  /** A run has just started: the moment to show how to play. */
  showControls: boolean;
}

/** How a game's score reads and ranks. */
export interface ScoreSpec {
  /** Which way it counts: a distance is `desc`, a time is `asc`. */
  order: ScoreOrder;
  /** The number as a board line shows it, without a unit. */
  format(score: number): string;
  /** Said after the number on the result card and in sentences ("점"); none for a time. */
  unitKey?: TranslationKey;
  /** The rules' absolute cap on an entry (`maxEntryScore` in firestore.rules). */
  maxEntry: number;
}

/** One label/value row under the score on the result card. */
export interface ResultDetail {
  labelKey: TranslationKey;
  value: string;
}

export interface NativeGame {
  /** The whole page, built by the game's package (`build:embed`). */
  html: string;
  /** The game's name: on its home chip and its Hall of Fame. */
  titleKey: TranslationKey;
  /** The result card's headline for how the run ended. */
  headline(over: GameOver): TranslationKey;
  score: ScoreSpec;
  /** Rows from `game:over.stats` for the result card. */
  details?(stats: GameStats, tpl: Translate): ResultDetail[];
  /** What the host draws over the page: the title, the controls, the pause card. */
  Overlay: ComponentType<StageProps>;
  /** A crash can be continued after a rewarded ad; without, no ad is ever loaded. */
  revives: boolean;
  /** The page takes typed text, so the web view lets its input raise the keyboard. */
  keyboard: boolean;
  /** The page makes sound, so the screen offers a sound on/off button (`host:sound`). */
  sound: boolean;
  /** Colour behind the page and the chrome around it. */
  background: string;
  /** Laid over the page behind the result cards. */
  scrim: string;
  /** The home screen tile's Tossface emoji. */
  homeEmoji: string;
}

export const NATIVE_GAMES: Record<NativeGameId, NativeGame> = {
  'wave-run': {
    html: WAVE_RUN_HTML,
    titleKey: 'game.waveRun.title',
    headline: ({ hit }) =>
      hit === 'wave' ? 'game.waveRun.hit.wave' : hit === 'bus' ? 'game.waveRun.hit.bus' : 'game.waveRun.hit.ripple',
    score: { order: 'desc', format: (n) => n.toLocaleString(), unitKey: 'game.pointUnit', maxEntry: 99999 },
    Overlay: WaveRunOverlay,
    revives: true,
    keyboard: false,
    sound: true,
    background: '#073E32',
    scrim: 'rgba(4,32,26,0.5)',
    homeEmoji: '\u{1F3C4}',
  },
  'subway-typing': {
    html: SUBWAY_TYPING_HTML,
    titleKey: 'game.subwayTyping.title',
    headline: () => 'game.subwayTyping.arrived',
    // A time, fastest first; the rules' floor is packages/subway-typing/src/bound.ts.
    score: { order: 'asc', format: formatTime, maxEntry: 3_600_000 },
    details: (stats, tpl) => {
      const rows: ResultDetail[] = [];
      if (stats.kpm !== undefined) rows.push({ labelKey: 'game.subwayTyping.kpm', value: tpl('game.subwayTyping.kpmValue', stats.kpm) });
      if (stats.accuracy !== undefined) rows.push({ labelKey: 'game.subwayTyping.accuracy', value: `${stats.accuracy}%` });
      if (stats.typos !== undefined) rows.push({ labelKey: 'game.subwayTyping.typos', value: tpl('game.subwayTyping.typosValue', stats.typos) });
      return rows;
    },
    Overlay: SubwayTypingOverlay,
    revives: false,
    keyboard: true,
    sound: true,
    background: SUBWAY_TYPING_BACKGROUND,
    scrim: 'rgba(0,0,0,0.4)',
    homeEmoji: '\u{1F687}',
  },
};

/** A score in a sentence or a label: the number and its unit. */
export function scoreText(game: NativeGame, score: number, t: (key: TranslationKey) => string): string {
  const { format, unitKey } = game.score;
  return unitKey ? `${format(score)}${t(unitKey)}` : format(score);
}
