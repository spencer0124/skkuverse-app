// ── App → WebView messages ──

export type AppToWebMessage =
  | { type: 'app:auth-token'; token: string }
  | { type: 'app:navigate'; path: string }
  | { type: 'app:theme-changed'; theme: 'light' | 'dark' }
  | { type: 'app:locale-changed'; locale: string };

// ── WebView → App messages ──

export interface MapSelectPayload {
  action: 'add' | 'delete';
  placename: string;
  buildingname: string;
  previousplace: string | null;
  afterplace: string | null;
  placeinfo: string | null;
  time: string | null;
  leftColor: string;
  rightColor: string;
}

export type WebToAppMessage =
  | { type: 'web:ready' }
  | { type: 'web:navigate'; path: string }
  | { type: 'web:analytics'; event: string; params?: Record<string, unknown> }
  | { type: 'web:haptic'; style: 'light' | 'medium' | 'heavy' }
  /**
   * Open a URL outside the page. `url` is always the web address. `appUrl`, when
   * set, is an app's own scheme (`spotify:track:…`, `youtube://…`) that the host
   * tries first, falling back to `url` when nothing on the device handles it.
   * A host that predates `appUrl` ignores it and opens `url`, so a page can send
   * it unconditionally.
   */
  | { type: 'web:open-url'; url: string; appUrl?: string }
  | { type: 'web:map-select'; payload: MapSelectPayload }
  /**
   * Ask the app to perform an action, in the server's actionType/actionValue
   * shape. Pages get a strict subset: `map` (a place, `[<kind>:]<placeId>`) and
   * `miniapp` (`<id>[/path]`). Feature-detect with
   * `window.skkuverse?.bridge?.actions`, which lists what the host accepts.
   */
  | { type: 'web:action'; actionType: string; actionValue: string };
