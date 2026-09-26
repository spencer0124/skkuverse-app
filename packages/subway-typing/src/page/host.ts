/**
 * The page's end of `@skkuverse/game-host`: post to the native screen, and
 * hear what it says back. Installed on import, so `window.__host` exists before
 * the page announces itself with `game:ready`.
 */
import { parseHostMessage, type GameMessage, type HostMessage } from '@skkuverse/game-host';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    __host?: (message: unknown) => void;
  }
}

export function post(message: GameMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

type Listener = (message: HostMessage) => void;
const listeners = new Set<Listener>();

window.__host = (raw) => {
  const m = parseHostMessage(raw);
  if (m) listeners.forEach((listener) => listener(m));
};

export function onHost(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
