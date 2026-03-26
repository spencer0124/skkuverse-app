// ── App → WebView messages ──

export type AppToWebMessage =
  | { type: 'app:auth-token'; token: string }
  | { type: 'app:navigate'; path: string }
  | { type: 'app:theme-changed'; theme: 'light' | 'dark' }
  | { type: 'app:locale-changed'; locale: string };

// ── WebView → App messages ──

export type WebToAppMessage =
  | { type: 'web:ready' }
  | { type: 'web:navigate'; path: string }
  | { type: 'web:analytics'; event: string; params?: Record<string, unknown> }
  | { type: 'web:haptic'; style: 'light' | 'medium' | 'heavy' };
