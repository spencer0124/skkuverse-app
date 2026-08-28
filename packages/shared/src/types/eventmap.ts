/**
 * Event map wire types — what `GET /eventmap/manifest` and
 * `GET /eventmap/snapshot/:id/:version` actually return.
 *
 * The server has already resolved every i18n string to a flat string, every date
 * to an ISO instant, and every icon reference to an id in the `icons` dict. The
 * app resolves exactly three things, none of them a business rule: predicate
 * evaluation, distance, and status against the device clock.
 *
 * ## Mirrored from skkuverse-server/src/eventmap/types.ts
 *
 * The server prefixes its wire types `Wire*` to separate them from its own
 * storage and config types. Those land here in a barrel next to `SduiSection`
 * and `MapLayerDef`, where "Wire" says nothing, so they are renamed. This table
 * keeps a cross-repo diff mechanical:
 *
 * | here                  | skkuverse-server        |
 * | --------------------- | ----------------------- |
 * | `EventMapAction`      | `WireAction`            |
 * | `EventMapLayer`       | `WireLayer`             |
 * | `EventMapChip`        | `WireChip`              |
 * | `EventMapChipGroup`   | `WireChipGroup`         |
 * | `EventMapSort`        | `WireSort`              |
 * | `EventMapCardSlot`    | `WireCardSlot`          |
 * | `EventMapCardTemplate`| `WireCardTemplate`      |
 * | everything else       | same name               |
 *
 * Contract: skkuverse-server/docs/reference/eventmap-api.md
 * Rendering: docs/explanation/eventmap-rendering.md
 * Ownership: umbrella ADR 0004
 */

import type { AppLanguage, Campus } from '../store/settings';
import type { ActionType } from './sdui';

/**
 * A snapshot declaring a higher version describes a shape this build cannot be
 * trusted to render, so it is ignored entirely and the base map is left alone.
 * Bump only for a breaking change — the schema is additive-only, and unknown
 * fields are already ignored by the parser.
 */
export const EVENTMAP_SCHEMA_VERSION = 1;

// ── Closed unions ──

export const ITEM_STATUSES = ['open', 'upcoming', 'closed', 'unknown'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** `cluster` and `list` stay in the contract so switching is a server edit. */
export const LAYER_RENDERS = ['pin', 'cluster', 'list'] as const;
export type LayerRender = (typeof LAYER_RENDERS)[number];

/** `distance` is absent: it needs expo-location, which is not a dependency. */
export const SORT_KEYS = ['order', 'title', 'startAt'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/**
 * The closed predicate node set, shared by layer filters and chips.
 *
 * Canonical list: eventmap-api.md §2. The server validates against its own copy
 * and this file carries the app's; `__tests__/predicate.test.ts` asserts every
 * predicate in the live ESKARA config passes `isValidPredicate`, so a node kind
 * added server-side fails app CI rather than silently hiding pins.
 */
export const PREDICATE_KINDS = [
  'all',
  'has',
  'hasAny',
  'hasAll',
  'not',
  'and',
  'or',
  'status',
] as const;

export type Predicate =
  | ['all']
  | ['has', string]
  | ['hasAny', string[]]
  | ['hasAll', string[]]
  | ['not', Predicate]
  | ['and', Predicate[]]
  | ['or', Predicate[]]
  | ['status', ItemStatus[]];

/**
 * ESKARA 2026 ships `symbol` only. `remote` is declared so swapping in real pin
 * art is a server config edit with no client release — but a remote URI that
 * 404s renders a blank marker, which the parser cannot detect.
 */
export type IconSpec =
  | { kind: 'symbol'; symbol: string }
  | { kind: 'remote'; uri: string; width: number; height: number };

// ── Structure ──

export interface EventMapAction {
  id: string;
  label: string;
  actionType: ActionType;
  /** Always a complete URL, except for `content` where it is prose. */
  actionValue: string;
  style?: 'primary' | 'secondary';
}

export interface EventMapLayer {
  id: string;
  render: LayerRender;
  label: string;
  filter: Predicate;
  defaultVisible: boolean;
  minZoom: number | null;
  maxZoom: number | null;
  iconId: string;
  sortId: string;
}

export interface EventMapChip {
  id: string;
  label: string;
  defaultSelected: boolean;
  predicate: Predicate;
}

export interface EventMapChipGroup {
  id: string;
  label: string | null;
  selection: 'single' | 'multi';
  chips: EventMapChip[];
}

export interface EventMapSort {
  id: string;
  label: string;
  by: SortKey;
}

export type EventMapCardSlot =
  | { kind: 'title' }
  | { kind: 'subtitle' }
  | { kind: 'hours' }
  | { kind: 'thumbnail' }
  | { kind: 'tags' }
  | { kind: 'field'; fieldKey: string; label: string };

export interface EventMapCardTemplate {
  id: string;
  slots: EventMapCardSlot[];
}

// ── Items ──

export interface EventMapItem {
  id: string;
  placeId: string;
  /** Items sharing this draw one marker; a tap lists all of them. */
  stackKey: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string | null;
  tags: string[];
  /**
   * As of `materializedAt`. `startAt`/`endAt` travel with it because the version
   * does not move on an idle tick and the payload is served `immutable,
   * max-age=1y`, so re-deriving against the device clock is the only way a booth
   * flips to open at 18:00 — and the only way the map stays truthful offline.
   *
   * Both bounds null is the server's ONLY way to say "do not recompute this
   * one". It pulls that lever for cancelled sessions and for one-sided windows
   * alike, so a client that recomputes anyway reopens a rain-cancelled bar at
   * its original start time.
   */
  status: ItemStatus;
  startAt: string | null;
  endAt: string | null;
  hoursLabel: string | null;
  iconId: string;
  iconIdClosed: string | null;
  pinPriority: number;
  cardTemplateId: string;
  order: number;
  media: { thumbnailUrl: string | null; images: string[] };
  fields: Record<string, string | number>;
  actions: EventMapAction[];
}

// ── Top level ──

export interface EventMapSnapshot {
  schemaVersion: number;
  /** layerSetId, e.g. "eskara-2026". */
  id: string;
  version: number;
  lang: AppLanguage;
  materializedAt: string;
  nextChangeAt: string | null;
  timezone: string;
  campus: Campus;
  camera: { lat: number; lng: number; zoom: number };
  icons: Record<string, IconSpec>;
  layers: EventMapLayer[];
  chipGroups: EventMapChipGroup[];
  sorts: EventMapSort[];
  cardTemplates: EventMapCardTemplate[];
  items: EventMapItem[];
}

export interface EventMapManifest {
  schemaVersion: number;
  activeLayerSetId: string | null;
  version: number | null;
  /** Formed server-side including `?lang=`. The client only joins it to the base URL. */
  snapshotUrl: string | null;
  refreshAfterSec: number;
  nextChangeAt: string | null;
  publishedAt: string | null;
}
