/**
 * SDUI (Server-Driven UI) type definitions.
 *
 * Discriminated union mirroring Flutter's sealed `SduiSection` class.
 * Each variant has a `type` literal discriminant for exhaustive switching.
 *
 * Flutter source: lib/core/model/sdui_section.dart
 *                 lib/core/model/campus_service_model.dart
 */

import { asMember } from '../utils/allowlist';

// ── Action types ──

/**
 * `'unknown'` is a client-side sentinel, never sent by the server. It exists so a
 * value we cannot interpret has somewhere to land other than a real behaviour.
 */
export type ActionType =
  | 'content'
  | 'route'
  | 'webview'
  | 'external'
  | 'miniapp'
  | 'unknown';

/** Everything the server may legitimately send. `'unknown'` is deliberately absent. */
const WIRE_ACTION_TYPES = [
  'content',
  'route',
  'webview',
  'external',
  'miniapp',
] as const;

/**
 * Parses a raw action type from the server. `"url"` is a legacy spelling of
 * `"external"`.
 *
 * Unknown values used to become `'external'`, inherited from Flutter's
 * `ActionType.fromString`. That meant a typo'd or newer-than-this-build action
 * type got handed to a URL opener — so the failure mode of not understanding
 * something was to open it in a browser anyway. Now it becomes `'unknown'` and
 * `handleSduiAction` does nothing with it. Doing nothing is recoverable; opening
 * an arbitrary string is not.
 */
export function parseActionType(raw: unknown): ActionType {
  if (raw === 'url') return 'external';
  return asMember(raw, WIRE_ACTION_TYPES) ?? 'unknown';
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
