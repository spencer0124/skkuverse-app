/**
 * The campus sheet's hand-off to a modal, as pure state.
 *
 * Two sheets on one screen must not stack. When a detail modal asks for the
 * screen, the campus sheet goes down first and the modal rises once it has
 * landed; when the modal goes, the sheet returns to the detent it left. The
 * transitions live here, import-free, so they run under `node --test` — the
 * screen holds the refs and makes the animation calls, and decides nothing.
 *
 * `index` is gorhom's settled index, `-1` when closed. `restoreTo` is the
 * detent to return to — `null` while no modal has the screen — and it is kept
 * across a nested request, so a modal replacing another still returns the
 * sheet to where the USER left it rather than to where the first modal found
 * it. `waiting` is a modal that has asked and is held until the sheet lands.
 */

export interface SheetHandoff {
  index: number;
  restoreTo: number | null;
  waiting: boolean;
}

export const IDLE_HANDOFF: SheetHandoff = { index: 0, restoreTo: null, waiting: false };

/**
 * A modal asks for the screen.
 *
 * `close` means "send the sheet down and wait"; `present` means "the sheet is
 * already down, go now". Never both.
 */
export function requestHandoff(s: SheetHandoff): {
  state: SheetHandoff;
  close: boolean;
  present: boolean;
} {
  if (s.index < 0) {
    return { state: { ...s, waiting: false }, close: false, present: true };
  }
  return {
    state: { ...s, restoreTo: s.restoreTo ?? s.index, waiting: true },
    close: true,
    present: false,
  };
}

/**
 * The sheet reported a settled detent. gorhom reports every one through the
 * same callback, so only the closed one releases a waiting modal — and only
 * once, since the wait is cleared with it.
 */
export function sheetSettled(
  s: SheetHandoff,
  index: number,
): { state: SheetHandoff; present: boolean } {
  const present = index < 0 && s.waiting;
  return { state: { ...s, index, waiting: present ? false : s.waiting }, present };
}

/**
 * The modal went away. `snapTo` is the detent to return to, or `null` when no
 * hand-off was in progress — a sheet the user left alone must not jump. A modal
 * still waiting is dropped with it, so a cancelled hand-off cannot present
 * something later.
 */
export function releaseHandoff(s: SheetHandoff): {
  state: SheetHandoff;
  snapTo: number | null;
} {
  return { state: { ...s, restoreTo: null, waiting: false }, snapTo: s.restoreTo };
}
