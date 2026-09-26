import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { hostScript, parseGameMessage, type GameMessage, type HostMessage } from '@skkuverse/game-host';

export interface GameShellHandle {
  send(message: HostMessage): void;
}

interface Props {
  html: string;
  background: string;
  /** The page takes typed text (registry `keyboard`). */
  keyboard: boolean;
  onMessage(message: GameMessage): void;
}

/**
 * The safe area, as CSS variables the page can pad with: `--inset-top`,
 * `--inset-bottom`, `--inset-left`, `--inset-right` (px). Set before the page
 * runs, and again whenever the insets change (rotation).
 */
function insetScript(i: EdgeInsets): string {
  const vars = { top: i.top, bottom: i.bottom, left: i.left, right: i.right };
  const set = Object.entries(vars)
    .map(([k, v]) => `s.setProperty('--inset-${k}','${Math.round(v)}px');`)
    .join('');
  return `(function(){var r=document.documentElement;if(!r)return;var s=r.style;${set}})();true;`;
}

/**
 * The bundled game page. It is an app asset, not a site: it loads from a
 * string, may not navigate anywhere, and speaks only `@skkuverse/game-host`.
 */
export const GameShell = forwardRef<GameShellHandle, Props>(function GameShell({ html, background, keyboard, onMessage }, ref) {
  const webRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const insetJs = insetScript(insets);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) webRef.current?.injectJavaScript(insetJs);
    mounted.current = true;
  }, [insetJs]);

  useImperativeHandle(ref, () => ({
    send: (message) => webRef.current?.injectJavaScript(hostScript(message)),
  }));

  const handleMessage = (e: WebViewMessageEvent) => {
    const m = parseGameMessage(e.nativeEvent.data);
    if (!m) return;
    // Android runs the before-load script from onPageStarted, which can land
    // on a document that is then replaced: set the insets again once the page
    // is known to be there.
    if (m.type === 'game:ready') webRef.current?.injectJavaScript(insetJs);
    onMessage(m);
  };

  // The page is loaded from a string (about:blank, or a data: URL on some
  // Android versions); anything else would be the page trying to leave.
  const onlyThePage = (req: ShouldStartLoadRequest) => req.url.startsWith('about:') || req.url.startsWith('data:');

  return (
    <WebView
      ref={webRef}
      source={{ html }}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={onlyThePage}
      onMessage={handleMessage}
      style={[styles.web, { backgroundColor: background }]}
      containerStyle={{ backgroundColor: background }}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
      // A game that takes typed text needs the text system for its input
      // (caret, IME composition); one that does not must never select text
      // under a long press.
      textInteractionEnabled={keyboard}
      // iOS: the ⌃⌄ Done bar above the keyboard is height the game needs.
      hideKeyboardAccessoryView={keyboard}
      injectedJavaScriptBeforeContentLoaded={insetJs}
      domStorageEnabled={false}
      androidLayerType="hardware"
      webviewDebuggingEnabled={__DEV__}
      // The page's process can be killed under memory pressure (an ad is a
      // likely moment). Reloading brings back game:ready and a fresh run.
      onContentProcessDidTerminate={() => webRef.current?.reload()}
      onRenderProcessGone={() => webRef.current?.reload()}
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1 },
});
