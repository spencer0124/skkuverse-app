/**
 * What the app needs from the game outside its page: the time format, the
 * floor the leaderboard's rules mirror, and the room the page leaves for the
 * host's overlay. Nothing here touches the DOM.
 */
export { MIN_RUN_MS, TOTAL_KEYS } from './bound';
export { BACKGROUND, CHROME_HEIGHT, TITLE_HEIGHT } from './layout';
export { formatTime } from './lib/stats';
