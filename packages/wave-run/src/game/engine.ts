import {
  ACCELERATION,
  CLEAR_TICKS,
  MAX_SPEED,
  MAX_REVIVES,
  MILESTONE,
  NIGHT_EVERY,
  NIGHT_FADE_TICKS,
  REVIVE_CLEAR_TICKS,
  SCORE_COEFFICIENT,
  START_SPEED,
} from './constants';
import { anyOverlap } from './collision';
import { obstacleBoxes, updateObstacles, type Obstacle, type ObstacleKind } from './obstacles';
import {
  createPlayer,
  playerBoxes,
  pressDuck,
  releaseDuck,
  releaseJump,
  startJump,
  updatePlayer,
  type Player,
} from './player';

export type Input = 'jump' | 'jumpEnd' | 'duck' | 'duckEnd';

export interface RecordedInput {
  tick: number;
  /** A player input, or the host bringing a crashed run back. */
  input: Input | 'revive';
}

export type GameEvent =
  | { type: 'jump'; double: boolean }
  /** Ducking in the air: the runner starts to plunge. */
  | { type: 'dive' }
  /** Back on the ground; `hard` when it came down in a dive. */
  | { type: 'land'; hard: boolean }
  | { type: 'milestone'; score: number }
  | { type: 'crash'; into: ObstacleKind };

export type Status = 'ready' | 'running' | 'crashed';

export interface GameState {
  seed: number;
  rng: number;
  status: Status;
  /** Ticks since the run started. */
  tick: number;
  speed: number;
  distance: number;
  prevDistance: number;
  score: number;
  player: Player;
  obstacles: Obstacle[];
  history: ObstacleKind[];
  only: ObstacleKind | null;
  /** What ended the run. */
  hit: ObstacleKind | null;
  /** Times the run has come back from a crash. */
  revives: number;
  /** Nothing spawns before this tick; a revive pushes it forward. */
  graceUntil: number;
  /** 0 = day, 1 = night; eases toward the phase the score calls for. */
  night: number;
  /** What happened during the last step, for the shell to react to. */
  events: GameEvent[];
  /** Every input the run consumed, stamped with the tick it applied on. */
  inputs: RecordedInput[];
}

export interface GameOptions {
  /** Debug: begin partway into a run. */
  startSpeed?: number;
  startScore?: number;
  /** Debug: spawn only this kind of obstacle. */
  only?: ObstacleKind;
}

export function createGame(seed: number, options: GameOptions = {}): GameState {
  const distance = (options.startScore ?? 0) / SCORE_COEFFICIENT;
  return {
    seed,
    rng: seed,
    status: 'ready',
    tick: 0,
    speed: options.startSpeed ?? START_SPEED,
    distance,
    prevDistance: distance,
    score: Math.floor(distance * SCORE_COEFFICIENT),
    player: createPlayer(),
    obstacles: [],
    history: [],
    only: options.only ?? null,
    hit: null,
    revives: 0,
    graceUntil: CLEAR_TICKS,
    night: 0,
    events: [],
    inputs: [],
  };
}

/** Leave the title pose and start running. A replay calls this, then feeds the inputs. */
export function beginRun(s: GameState): void {
  if (s.status === 'ready') s.status = 'running';
}

function applyInput(s: GameState, input: Input): void {
  const p = s.player;
  switch (input) {
    case 'jump': {
      p.jumpHeld = true;
      const kind = startJump(p, s.speed);
      if (kind) s.events.push({ type: 'jump', double: kind === 'double' });
      break;
    }
    case 'jumpEnd':
      p.jumpHeld = false;
      releaseJump(p);
      break;
    case 'duck': {
      p.duckHeld = true;
      const diving = p.speedDrop;
      pressDuck(p);
      if (p.speedDrop && !diving) s.events.push({ type: 'dive' });
      break;
    }
    case 'duckEnd':
      p.duckHeld = false;
      releaseDuck(p);
      break;
  }
}

/**
 * Advance one tick. Inputs apply first, so a press lands on the tick it is
 * given for; a replay that feeds the same inputs on the same ticks reproduces
 * the run exactly.
 */
export function step(s: GameState, inputs: readonly Input[] = []): void {
  s.events = [];
  if (s.status !== 'running') return;

  for (const input of inputs) {
    s.inputs.push({ tick: s.tick, input });
    applyInput(s, input);
  }

  const airborne = s.player.jumping;
  const diving = s.player.speedDrop;
  updatePlayer(s.player);
  if (airborne && !s.player.jumping) s.events.push({ type: 'land', hard: diving });
  updateObstacles(s, s.speed, s.tick >= s.graceUntil);

  const mine = playerBoxes(s.player);
  for (const o of s.obstacles) {
    if (anyOverlap(mine, obstacleBoxes(o))) {
      s.status = 'crashed';
      s.hit = o.kind;
      s.events.push({ type: 'crash', into: o.kind });
      return;
    }
  }

  s.prevDistance = s.distance;
  s.distance += s.speed;
  const score = Math.floor(s.distance * SCORE_COEFFICIENT);
  if (Math.floor(score / MILESTONE) > Math.floor(s.score / MILESTONE)) {
    s.events.push({ type: 'milestone', score: Math.floor(score / MILESTONE) * MILESTONE });
  }
  s.score = score;
  if (s.speed < MAX_SPEED) s.speed = Math.min(MAX_SPEED, s.speed + ACCELERATION);

  const nightTarget = Math.floor(s.score / NIGHT_EVERY) % 2;
  const fade = 1 / NIGHT_FADE_TICKS;
  s.night = nightTarget > s.night ? Math.min(1, s.night + fade) : Math.max(0, s.night - fade);

  s.tick++;
}

/**
 * Bring a crashed run back: the track is cleared, the runner stands up where it
 * fell, and nothing spawns for a moment. Score, speed and the tick carry on, so
 * a revive buys time rather than points. Recorded like an input, on the tick it
 * happened, so a replay can do the same.
 */
export function revive(s: GameState): boolean {
  if (s.status !== 'crashed' || s.revives >= MAX_REVIVES) return false;
  s.revives++;
  s.status = 'running';
  s.hit = null;
  s.obstacles = [];
  s.player = createPlayer();
  s.graceUntil = s.tick + REVIVE_CLEAR_TICKS;
  s.inputs.push({ tick: s.tick, input: 'revive' });
  s.events = [];
  return true;
}

/** What a finished run hands on: to the high score now, to a leaderboard later. */
export interface GameResult {
  version: 2;
  seed: number;
  score: number;
  ticks: number;
  hit: ObstacleKind | null;
  revives: number;
  inputs: RecordedInput[];
}

export function resultOf(s: GameState): GameResult {
  return { version: 2, seed: s.seed, score: s.score, ticks: s.tick, hit: s.hit, revives: s.revives, inputs: s.inputs };
}
