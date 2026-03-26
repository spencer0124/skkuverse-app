/**
 * SDUI (Server-Driven UI) type definitions.
 *
 * Discriminated union mirroring Flutter's sealed `SduiSection` class.
 * Each variant has a `type` literal discriminant for exhaustive switching.
 *
 * Flutter source: lib/core/model/sdui_section.dart
 *                 lib/core/model/campus_service_model.dart
 */

// ── Action types ──

export type ActionType = 'route' | 'webview' | 'external';

/**
 * Parses raw action type string from server.
 * Server sends "url" for external links — maps to "external".
 * Unknown values default to "external" (matches Flutter's ActionType.fromString).
 */
export function parseActionType(raw: string): ActionType {
  if (raw === 'url') return 'external';
  if (raw === 'route' || raw === 'webview' || raw === 'external') return raw;
  return 'external';
}

// ── Button item ──

export interface SduiButtonItem {
  id: string;
  title: string;
  emoji: string;
  actionType: ActionType;
  actionValue: string;
  webviewTitle?: string;
  webviewColor?: string;
}

// ── Section variants ──

export interface SduiButtonGrid {
  type: 'button_grid';
  id: string;
  columns: number;
  items: SduiButtonItem[];
}

export interface SduiSectionTitle {
  type: 'section_title';
  id: string;
  title: string;
}

export interface SduiNotice {
  type: 'notice';
  id: string;
  title: string;
  actionType: ActionType;
  actionValue: string;
}

export interface SduiBanner {
  type: 'banner';
  id: string;
  imageUrl: string;
  actionType: ActionType;
  actionValue: string;
}

export interface SduiSpacer {
  type: 'spacer';
  id: string;
  height: number;
}

export interface SduiUnknown {
  type: 'unknown';
  id: string;
  /** Original type string from server, preserved for debugging */
  originalType: string;
}

/** Discriminated union of all SDUI section types */
export type SduiSection =
  | SduiButtonGrid
  | SduiSectionTitle
  | SduiNotice
  | SduiBanner
  | SduiSpacer
  | SduiUnknown;

// ── Response wrapper ──

export interface CampusSectionsResponse {
  sections: SduiSection[];
  minAppVersion: string | null;
}
