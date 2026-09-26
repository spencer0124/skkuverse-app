/**
 * Where the page leaves room for what the host draws over it, in CSS px below
 * the top safe-area inset. The page and the app's overlay
 * (apps/mobile/src/features/games/subway-typing/Overlay.tsx) both import
 * these, so the two can only agree.
 */

/** Clear of the host's floating buttons (40 px, 8 px below the inset). */
export const CHROME_HEIGHT = 56;

/** The title block the overlay draws on the title screen, under the chrome. */
export const TITLE_HEIGHT = 136;

/** The page's background, and the host's around it. */
export const BACKGROUND = '#FFFFFF';
