import type { Input } from './engine';

/**
 * Two thumbs on a portrait screen: the right half jumps (hold for height), the
 * left half ducks while held. Split zones rather than a swipe, because a swipe
 * is only known after the finger moves, and by then a pointerdown has already
 * had to choose. Pressing — never dragging — also stays clear of the mini-app
 * shell's edge-swipe, which closes the screen from the left edge.
 *
 * `press` receives the start of an action and `release` its end; each pointer
 * remembers which half it began in, so sliding across the middle while held
 * does not switch actions.
 */
export function bindInput(el: HTMLElement, press: (i: Input) => void): () => void {
  const held = new Map<number, 'jump' | 'duck'>();

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const action = e.clientX < rect.left + rect.width / 2 ? 'duck' : 'jump';
    held.set(e.pointerId, action);
    press(action);
  };
  const onUp = (e: PointerEvent) => {
    const action = held.get(e.pointerId);
    if (!action) return;
    held.delete(e.pointerId);
    press(action === 'jump' ? 'jumpEnd' : 'duckEnd');
  };

  const keyAction = (code: string): 'jump' | 'duck' | null =>
    code === 'Space' || code === 'ArrowUp' || code === 'KeyW'
      ? 'jump'
      : code === 'ArrowDown' || code === 'KeyS'
        ? 'duck'
        : null;
  const onKeyDown = (e: KeyboardEvent) => {
    const action = keyAction(e.code);
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) press(action);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const action = keyAction(e.code);
    if (action) press(action === 'jump' ? 'jumpEnd' : 'duckEnd');
  };
  const noMenu = (e: Event) => e.preventDefault();

  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  el.addEventListener('contextmenu', noMenu);
  return () => {
    el.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    el.removeEventListener('contextmenu', noMenu);
  };
}
