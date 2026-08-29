/**
 * Event map wire types — what `GET /eventmap/manifest` and
 * `GET /eventmap/snapshot/:id/:version` actually return.
 *
 * The server has already resolved every i18n string to a flat string and every
 * date to an ISO instant. The app resolves exactly one thing, and it is not a
 * business rule: status against the device clock. Which layer an item belongs
 * to arrives as `layerId` — a `/map/config` layer id, the same one the item's
 * marker carries — so the list and the pins can never disagree about membership.
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
 * The one schema this build reads. A snapshot declaring any other version is
 * ignored entirely and the base map is left alone — older as well as newer,
 * because a bump means a breaking change: v2 removed the predicate layers, the
 * chip groups and the icon table, and every item gained `layerId`. Within a
 * version the schema is additive-only and the parser ignores unknown fields,
 * so bump only for a change of that kind.
 */
export const EVENTMAP_SCHEMA_VERSION = 2;

// ── Closed unions ──

export const ITEM_STATUSES = ['open', 'upcoming', 'closed', 'unknown'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** `distance` is absent: it needs expo-location, which is not a dependency. */
export const SORT_KEYS = ['order', 'title', 'startAt'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

// ── Structure ──

export interface EventMapAction {
  id: string;
  label: string;
  actionType: ActionType;
  /** Always a complete URL, except for `content` where it is prose. */
  actionValue: string;
  style?: 'primary' | 'secondary';
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
  /** Author tags only. Nothing derived travels here any more. */
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
  /**
   * The `/map/config` layer this item belongs to — the same id its marker
   * carries on `/map/markers/event`, stamped by one resolver server-side. The
   * list filters on it. Required: an item without one is dropped at parse time,
   * since it could never be shown or hidden with its pin.
   */
  layerId: string;
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
