/**
 * Where a mini-app page may put its content: the protocol's `Viewport`, in the
 * WebView's own coordinates, computed from the shell and what the device and
 * the native header report.
 *
 * Two layers, as the protocol defines them. `safeArea` is what the device
 * covers (status bar, notch, home indicator) wherever it overlaps the WebView,
 * and zero on an edge the WebView does not reach. `contentSafeArea` is what the
 * shell's own chrome covers (the transparent header, the floating bottom bar).
 * A page pads with their sum, `--sv-inset-*`.
 *
 * The WebView's frame follows from the shell:
 *
 *   header 'opaque'   starts below the native header, so nothing covers its top
 *   header 'overlay'  starts at y = 0 under the status bar and a transparent
 *                     header
 *   bottom            always reaches the screen's bottom edge; with bar
 *                     'bottom' the floating bar sits over it
 *
 * Pure and free of React Native imports so `node --test` can pin the matrix.
 */
import type { Insets, ShellConfig, Viewport } from '@skkuverse/miniapp/protocol';

export interface ViewportInput {
  shell: Pick<ShellConfig, 'bar' | 'header'>;
  /** Device safe-area insets (`useSafeAreaInsets`). */
  insets: Insets;
  /**
   * The native header's full height, status bar included (`useHeaderHeight`).
   * Read only for `header: 'overlay'`.
   */
  headerHeight: number;
  /**
   * The floating bottom bar's height above the device's bottom safe area —
   * the part of the page it covers that `insets.bottom` does not already
   * count. Read only for `bar: 'bottom'`.
   */
  bottomBarHeight: number;
  /** Liquid Glass is available (iOS 26+, `isLiquidGlassAvailable()`). */
  glassAvailable: boolean;
}

const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

export function computeViewport({
  shell,
  insets,
  headerHeight,
  bottomBarHeight,
  glassAvailable,
}: ViewportInput): Viewport {
  const overlay = shell.header === 'overlay';
  const bottomBar = shell.bar === 'bottom';
  const top = nonNegative(insets.top);

  return {
    safeArea: {
      // Under an opaque header the WebView never reaches the status bar.
      top: overlay ? top : 0,
      bottom: nonNegative(insets.bottom),
      left: nonNegative(insets.left),
      right: nonNegative(insets.right),
    },
    contentSafeArea: {
      // The header's height below the status bar, which safeArea.top covers.
      top: overlay ? nonNegative(headerHeight - top) : 0,
      bottom: bottomBar ? nonNegative(bottomBarHeight) : 0,
      left: 0,
      right: 0,
    },
    // Glass only matters where something is drawn over the page; an opaque
    // header with no bottom bar covers nothing, whatever the OS offers.
    chrome: glassAvailable && (overlay || bottomBar) ? 'glass' : 'opaque',
  };
}
