/**
 * One run, as a reducer: pure, so the rules can be tested without a DOM.
 *
 * The clock starts on the first key, not on the start button. On a phone the
 * button is what raises the keyboard, and the time that takes is not the
 * player's.
 */

export type Phase = 'ready' | 'playing' | 'finished';

export interface GameState {
  phase: Phase;
  /**
   * Stations reached so far. 0 is waiting short of the first; the station
   * being typed is always `route[at]`.
   */
  at: number;
  /** `performance.now()` of the first key, or null before it. */
  startedAt: number | null;
  /** Ms from the first key to arriving at station `i`. */
  arrivals: number[];
  typos: number;
}

export type GameAction =
  | { type: 'start' }
  /** Back to the title with no run: the host closed the result. */
  | { type: 'reset' }
  | { type: 'key'; now: number }
  | { type: 'arrive'; now: number }
  | { type: 'typo' };

export const initialGame: GameState = {
  phase: 'ready',
  at: 0,
  startedAt: null,
  arrivals: [],
  typos: 0,
};

/** `stops` is how many stations a run types. */
export function gameReducer(stops: number) {
  return (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
      case 'start':
        return { ...initialGame, phase: 'playing' };
      case 'reset':
        return initialGame;
      case 'key':
        if (state.phase !== 'playing' || state.startedAt !== null) return state;
        return { ...state, startedAt: action.now };
      case 'typo':
        if (state.phase !== 'playing') return state;
        return { ...state, typos: state.typos + 1 };
      case 'arrive': {
        if (state.phase !== 'playing') return state;
        const startedAt = state.startedAt ?? action.now;
        const at = state.at + 1;
        return {
          ...state,
          startedAt,
          at,
          arrivals: [...state.arrivals, action.now - startedAt],
          phase: at >= stops ? 'finished' : 'playing',
        };
      }
    }
  };
}

/** Total time of a finished run. */
export const totalMs = (state: GameState) => state.arrivals.at(-1) ?? 0;
