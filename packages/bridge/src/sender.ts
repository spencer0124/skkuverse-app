import type { WebToAppMessage } from './types';

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

/**
 * Send a typed message from the web layer to the React Native app.
 * No-ops gracefully when not running inside a WebView.
 */
export function postToApp(msg: WebToAppMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}
