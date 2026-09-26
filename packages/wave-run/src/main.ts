/**
 * The page the app bundles into its game screen.
 *
 * Only the canvas lives here. The title, the pause card, the result sheet, the
 * high score, revives and the leaderboard are the host's — it draws them
 * natively over this page and talks to it through `@skkuverse/game-host`.
 */
import { parseHostMessage, type GameMessage } from '@skkuverse/game-host';
import { MAX_REVIVES } from './game/constants';
import { bindInput } from './game/input';
import { GameLoop } from './game/loop';
import { playSound, setSoundOn, unlockSound } from './sound/sfx';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    __host?: (message: unknown) => void;
  }
}

function post(message: GameMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

const stage = document.getElementById('stage')!;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const loop = new GameLoop(canvas, {
  onPhase: (phase) => post({ type: 'game:phase', phase }),
  onRunStart: () => post({ type: 'game:start' }),
  onCrash: (r) =>
    post({
      type: 'game:over',
      score: r.score,
      ticks: r.ticks,
      hit: r.hit,
      revives: r.revives,
      revivesLeft: MAX_REVIVES - r.revives,
    }),
  onHaptic: (style) => post({ type: 'game:haptic', style }),
  onSound: playSound,
});

window.__host = (raw) => {
  const m = parseHostMessage(raw);
  if (!m) return;
  switch (m.type) {
    case 'host:init':
      loop.setHighScore(m.hi);
      break;
    case 'host:revive':
      loop.revive();
      break;
    case 'host:restart':
      loop.restart();
      break;
    case 'host:reset':
      loop.reset();
      break;
    case 'host:pause':
      loop.pause();
      break;
    case 'host:resume':
      loop.resume();
      break;
    case 'host:sound':
      setSoundOn(m.on);
      break;
  }
};

const fit = () => {
  const r = stage.getBoundingClientRect();
  loop.resize(r.width, r.height, window.devicePixelRatio || 1);
};
new ResizeObserver(fit).observe(stage);
fit();

// Every press opens audio before the game hears it: the first so iOS lets
// sound start inside a tap, the rest to wake a context the OS suspended.
stage.addEventListener('pointerdown', unlockSound, { capture: true });
window.addEventListener('keydown', unlockSound, { capture: true });
bindInput(stage, (i) => loop.input(i));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.pause();
});
loop.start();
post({ type: 'game:ready' });
