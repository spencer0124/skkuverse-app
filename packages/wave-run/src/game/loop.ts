import type { HapticStyle } from '@skkuverse/game-host';
import type { CueName } from '../sound/sfx';
import { BIG_MILESTONE, TICK_MS } from './constants';
import { beginRun, createGame, resultOf, revive, step, type GameResult, type GameState, type Input } from './engine';
import { Renderer, type Overlay } from './render/draw';
import { newSeed } from './rng';

export type Phase = 'ready' | 'running' | 'paused' | 'crashed';

export interface LoopCallbacks {
  onPhase(phase: Phase): void;
  /** A new run begins — the first one or a restart, not a resume or a revive. */
  onRunStart(): void;
  /** Every crash passes through here; the host decides whether it is the end. */
  onCrash(result: GameResult): void;
  onHaptic(style: HapticStyle): void;
  onSound(cue: CueName): void;
}

/** Longest stretch simulated after a stall, so a hitch does not fast-forward into a crash. */
const MAX_FRAME_MS = 250;

/**
 * One tap of feedback a tick at most: when two moments land together (a
 * milestone as the best is passed), the stronger one is felt.
 */
const HAPTIC_RANK: Record<HapticStyle, number> = { light: 0, soft: 1, rigid: 2, medium: 3, error: 4, heavy: 5, success: 6 };
const stronger = (a: HapticStyle | null, b: HapticStyle): HapticStyle => (a && HAPTIC_RANK[a] >= HAPTIC_RANK[b] ? a : b);

/**
 * Runs the simulation at a fixed 60 Hz whatever the display rate, and draws in
 * between with interpolation. The fixed step is what makes a run replayable from
 * its seed and inputs; drawing at the display rate is what keeps a 120 Hz phone
 * smooth.
 *
 * The page is hosted by the app, which owns everything after a crash: the loop
 * never restarts or revives on a tap, it waits for the host to say so.
 */
export class GameLoop {
  private state: GameState;
  private readonly renderer: Renderer;
  private queue: Input[] = [];
  private acc = 0;
  private last = 0;
  private raf = 0;
  private phase: Phase = 'ready';
  private readonly overlay: Overlay;
  /** This run has already been told it passed the best. */
  private bestHeard = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly callbacks: LoopCallbacks,
  ) {
    this.renderer = new Renderer(canvas, () => callbacks.onSound('splash'));
    this.state = createGame(newSeed());
    this.overlay = { hi: 0, flashUntil: 0, crashedAt: null, doubleJump: null, debug: false };
  }

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.frame(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  resize(w: number, h: number, dpr: number): void {
    this.renderer.resize(w, h, dpr);
    this.renderer.render(this.state, 1, performance.now(), this.overlay);
  }

  /** The best score so far, kept by the host, for the HUD. */
  setHighScore(hi: number): void {
    this.overlay.hi = hi;
  }

  /** Every press and release from the player comes through here. */
  input(i: Input): void {
    const pressed = i === 'jump' || i === 'duck';
    if (this.phase === 'crashed') return;
    if (this.phase === 'paused') {
      if (pressed) this.resume();
      return;
    }
    if (this.phase === 'ready') {
      // The first press starts the run and also counts, so a jump press jumps.
      if (!pressed) return;
      this.run();
    }
    this.queue.push(i);
  }

  private run(): void {
    beginRun(this.state);
    this.callbacks.onRunStart();
    this.resetClock();
    this.setPhase('running');
  }

  /** Start a fresh run straight away, as the original does after a crash. Only from a crash. */
  restart(): void {
    if (this.phase !== 'crashed') return;
    this.state = createGame(newSeed());
    this.renderer.reset();
    this.overlay.crashedAt = null;
    this.overlay.doubleJump = null;
    this.queue = [];
    this.bestHeard = false;
    this.run();
  }

  /** Back to the title after a crash: a fresh game, waiting for the first tap. */
  reset(): void {
    if (this.phase !== 'crashed') return;
    this.state = createGame(newSeed());
    this.renderer.reset();
    this.overlay.crashedAt = null;
    this.overlay.doubleJump = null;
    this.queue = [];
    this.bestHeard = false;
    this.setPhase('ready');
  }

  /** Bring the crashed run back, if the engine allows another revive. */
  revive(): void {
    if (this.phase !== 'crashed' || !revive(this.state)) return;
    this.renderer.reset();
    this.overlay.crashedAt = null;
    this.overlay.doubleJump = null;
    this.queue = [];
    this.resetClock();
    this.callbacks.onSound('revive');
    this.callbacks.onHaptic('medium');
    this.setPhase('running');
  }

  /** The app went to the background mid-run. */
  pause(): void {
    if (this.phase !== 'running') return;
    // Whatever was held is released; the fingers are gone by the time it
    // resumes. Queued rather than stepped here, so a collision on that tick
    // still goes through tick() and reaches the host as a crash.
    this.queue.push('jumpEnd', 'duckEnd');
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.resetClock();
    this.setPhase('running');
  }

  private resetClock(): void {
    this.last = performance.now();
    this.acc = 0;
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.callbacks.onPhase(phase);
  }

  private frame(now: number): void {
    const dt = Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;

    if (this.phase === 'running') {
      this.acc += dt;
      while (this.acc >= TICK_MS && this.phase === 'running') {
        this.tick(now);
        this.acc -= TICK_MS;
      }
    }
    const alpha = this.phase === 'running' ? this.acc / TICK_MS : 1;
    this.renderer.render(this.state, alpha, now, this.overlay);
  }

  private tick(now: number): void {
    const inputs = this.queue;
    this.queue = [];
    step(this.state, inputs);
    const s = this.state;
    let haptic: HapticStyle | null = null;
    let chime: CueName | null = null;
    for (const e of s.events) {
      switch (e.type) {
        case 'jump':
          if (e.double) {
            this.overlay.doubleJump = { at: now, y: s.player.jumpBase };
            this.callbacks.onSound('doubleJump');
            haptic = stronger(haptic, 'soft');
          } else {
            this.callbacks.onSound('jump');
          }
          break;
        case 'dive':
          this.callbacks.onSound('dive');
          break;
        case 'land':
          // An ordinary landing is silent: it comes every second, and the next jump is already sounding.
          if (e.hard) {
            this.callbacks.onSound('land');
            haptic = stronger(haptic, 'rigid');
          }
          break;
        case 'milestone':
          this.overlay.flashUntil = now + 900;
          chime = e.score % BIG_MILESTONE === 0 ? 'thousand' : 'milestone';
          haptic = stronger(haptic, chime === 'thousand' ? 'medium' : 'light');
          break;
        case 'crash':
          this.callbacks.onSound('crash');
          haptic = stronger(haptic, 'heavy');
          break;
      }
    }
    // Past the best on record, once a run. A first run has no best to pass.
    if (s.status === 'running' && !this.bestHeard && this.overlay.hi > 0 && s.score > this.overlay.hi) {
      this.bestHeard = true;
      chime = 'best';
      haptic = stronger(haptic, 'success');
    }
    if (chime) this.callbacks.onSound(chime);
    if (haptic) this.callbacks.onHaptic(haptic);
    if (s.status === 'crashed') this.crash(now);
  }

  private crash(now: number): void {
    this.overlay.crashedAt = now;
    const result = resultOf(this.state);
    if (result.score > this.overlay.hi) this.overlay.hi = result.score;
    this.setPhase('crashed');
    this.callbacks.onCrash(result);
  }
}
