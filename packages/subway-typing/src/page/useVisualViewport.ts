import { useEffect, useState } from 'react';

export interface ViewportBox {
  top: number;
  height: number;
  /**
   * A soft keyboard borders the page's bottom edge, so the home indicator's
   * inset does not apply there. Not the same as the input having focus: with
   * a hardware keyboard the input is focused and nothing covers the bottom.
   */
  keyboardOpen: boolean;
}

/** The tallest the page has been: a web view resized for the keyboard (Android) is shorter than this. */
let fullHeight = 0;

function read(): ViewportBox {
  const vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0;
  const height = vv ? vv.height : window.innerHeight;
  fullHeight = Math.max(fullHeight, window.innerHeight);
  // iOS: the visual viewport shrinks and the layout one does not.
  // Android: the whole web view is resized, so the page itself gets shorter.
  const keyboardOpen = window.innerHeight - (top + height) > 40 || fullHeight - window.innerHeight > 120;
  return { top, height, keyboardOpen };
}

/**
 * The part of the screen the keyboard is not covering.
 *
 * On iOS a soft keyboard shrinks the visual viewport but not the layout one,
 * so `100%` still reaches behind it; sizing the game to `visualViewport` keeps
 * the input on top of the keyboard. WebKit also pans the visual viewport to
 * reveal a focused field, so the box follows `offsetTop` rather than fighting
 * it. Where the web view itself is resized for the keyboard (Android), the
 * visual viewport is simply the whole page and this changes nothing.
 */
export function useVisualViewport(): ViewportBox {
  const [box, setBox] = useState(read);

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setBox(read());
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return box;
}
