/**
 * Tolerant parsing of the event map wire payload.
 *
 * The server fails loud on config it can fix; the client fails soft on a payload
 * it can only render (ADR 0004 invariant 2). Every drop is counted and returned
 * alongside the snapshot rather than logged, which keeps this module pure — no
 * `__DEV__`, so it is safe under vitest, which has no shim for it.
 *
 * Style follows miniapps/schema.ts: small local guards, per-entry parse returning
 * null, `.filter()` the nulls. Deliberately not the unchecked-cast style of
 * map/parser.ts, which is what produced the defects this work also fixes.
 */

import type {
  EventMapAction,
  EventMapCardSlot,
  EventMapCardTemplate,
  EventMapItem,
  EventMapManifest,
  EventMapSnapshot,
  EventMapSort,
  ItemStatus,
  SortKey,
} from '../types/eventmap';
import { EVENTMAP_SCHEMA_VERSION, ITEM_STATUSES, SORT_KEYS } from '../types/eventmap';
import { parseActionType } from '../types/sdui';
// Imported, never redeclared: a second `['hssc','nsc'] as const` in this file
// would be a closed set with two homes, and the two would drift.
import { CAMPUSES } from '../constants/campus';
import { SUPPORTED_LANGUAGES } from '../i18n/constants';
import { asMember, toFiniteNumber } from '../utils/allowlist';

const HTTPS_RE = /^https:\/\//;
/**
 * A route must be absolute and single-slash: `//evil.com` is protocol-relative.
 *
 * The backslash is the same escape with a different keystroke, and it is the one
 * an anchored `(?!\/)` misses. WHATWG folds `\` into `/` for special schemes, so
 * `new URL('/\\evil.com', 'https://host/')` resolves to `https://evil.com/` —
 * verified, not assumed. A `route` value reaches `router.push` rather than a URL
 * opener today, so this is not reachable; it is closed here because the guard's
 * whole purpose is this class of escape, and the server's twin has it too.
 */
const ROUTE_RE = /^\/(?![/\\])\S*$/;

/** Counts, plus a capped sample so an unknown value is identifiable without a log flood. */
export interface DroppedCounts {
  sorts: number;
  cardTemplates: number;
  items: number;
  actions: number;
  reasons: string[];
}

const MAX_REASONS = 10;

function emptyDropped(): DroppedCounts {
  return { sorts: 0, cardTemplates: 0, items: 0, actions: 0, reasons: [] };
}

function note(dropped: DroppedCounts, reason: string): void {
  if (dropped.reasons.length < MAX_REASONS) dropped.reasons.push(reason);
}

// ── Local guards ──

function asRecord(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function asNullableString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asNullableNumber(v: unknown): number | null {
  return toFiniteNumber(v);
}

// ── Structure ──

function parseSort(raw: unknown, dropped: DroppedCounts): EventMapSort | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  const by = asMember<SortKey>(obj?.by, SORT_KEYS);
  if (!obj || !id || !by) {
    note(dropped, `sort ${String(obj?.id)}: unknown key ${String(obj?.by)}`);
    return null;
  }
  return { id, label: asString(obj.label) ?? id, by };
}

function parseCardSlot(raw: unknown): EventMapCardSlot | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  switch (obj.kind) {
    case 'title':
    case 'subtitle':
    case 'hours':
    case 'thumbnail':
    case 'tags':
      return { kind: obj.kind };
    case 'field': {
      const fieldKey = asString(obj.fieldKey);
      return fieldKey
        ? { kind: 'field', fieldKey, label: asString(obj.label) ?? fieldKey }
        : null;
    }
    default:
      return null;
  }
}

function parseCardTemplate(raw: unknown, dropped: DroppedCounts): EventMapCardTemplate | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  if (!obj || !id) {
    note(dropped, 'cardTemplate: missing id');
    return null;
  }
  const slots = (Array.isArray(obj.slots) ? obj.slots : [])
    .map(parseCardSlot)
    .filter((s): s is EventMapCardSlot => s !== null);
  return { id, slots };
}

// ── Actions ──

/**
 * `actionValue` is validated per type. A relative string handed to a URL opener
 * is the shape of an open redirect (ADR 0004), and `//evil.com` handed to a
 * router is the same trick one layer down — hence the single-slash route check.
 * A malformed action drops that one button; the item survives with its others.
 */
function isValidActionValue(actionType: EventMapAction['actionType'], value: string): boolean {
  switch (actionType) {
    case 'content':
      // Prose, not a destination. Any non-blank string is fine.
      return true;
    case 'route':
      return ROUTE_RE.test(value);
    case 'webview':
    case 'external':
    case 'miniapp':
      return HTTPS_RE.test(value) && !/\s/.test(value);
    default:
      return false;
  }
}

function parseAction(raw: unknown, dropped: DroppedCounts): EventMapAction | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  const value = asString(obj?.actionValue);
  if (!obj || !id || !value) {
    note(dropped, 'action: missing id or value');
    return null;
  }
  const actionType = parseActionType(obj.actionType);
  if (actionType === 'unknown') {
    note(dropped, `action ${id}: unknown type ${String(obj.actionType)}`);
    return null;
  }
  if (!isValidActionValue(actionType, value)) {
    note(dropped, `action ${id}: bad value for ${actionType}`);
    return null;
  }
  const style = obj.style === 'primary' || obj.style === 'secondary' ? obj.style : undefined;
  return {
    id,
    label: asString(obj.label) ?? '',
    actionType,
    actionValue: value,
    ...(style ? { style } : {}),
  };
}

// ── Items ──

function parseItem(raw: unknown, dropped: DroppedCounts): EventMapItem | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  if (!obj || !id) {
    note(dropped, 'item: missing id');
    return null;
  }
  const lat = toFiniteNumber(obj.lat);
  const lng = toFiniteNumber(obj.lng);
  if (lat === null || lng === null) {
    note(dropped, `item ${id}: non-finite coordinates`);
    return null;
  }
  // A [lng, lat] swap raises no error and puts the pin in the ocean. Seoul's
  // longitude is 126.97, so a swapped pair fails the latitude range for free.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    note(dropped, `item ${id}: coordinates out of range`);
    return null;
  }
  // Required, not defaulted: an item that names no layer could never be shown
  // or hidden with its pin, so the list would carry a row the map cannot
  // explain. Dropping it is also what makes a stale cache honest — a v1 item
  // has no layerId, and the schema gate above already turns that whole
  // snapshot away, so this is the per-item posture for a malformed v2 one.
  const layerId = asString(obj.layerId);
  if (!layerId) {
    note(dropped, `item ${id}: missing layerId`);
    return null;
  }

  const media = asRecord(obj.media);
  const fieldsRaw = asRecord(obj.fields) ?? {};
  const fields: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(fieldsRaw)) {
    if (typeof v === 'string' || typeof v === 'number') fields[k] = v;
  }

  const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
  const actions = rawActions
    .map((a) => parseAction(a, dropped))
    .filter((a): a is EventMapAction => a !== null);
  dropped.actions += rawActions.length - actions.length;

  return {
    id,
    placeId: asString(obj.placeId) ?? id,
    // Falling back to placeId keeps the "one marker per plot" default rather than
    // exploding a missing key into one marker per item.
    stackKey: asString(obj.stackKey) ?? asString(obj.placeId) ?? id,
    lat,
    lng,
    title: asString(obj.title) ?? '',
    subtitle: asNullableString(obj.subtitle),
    tags: asStringArray(obj.tags),
    status: asMember<ItemStatus>(obj.status, ITEM_STATUSES) ?? 'unknown',
    startAt: asNullableString(obj.startAt),
    endAt: asNullableString(obj.endAt),
    hoursLabel: asNullableString(obj.hoursLabel),
    layerId,
    pinPriority: toFiniteNumber(obj.pinPriority) ?? 0,
    cardTemplateId: asString(obj.cardTemplateId) ?? '',
    order: toFiniteNumber(obj.order) ?? 0,
    media: {
      thumbnailUrl: asNullableString(media?.thumbnailUrl),
      images: asStringArray(media?.images),
    },
    fields,
    actions,
  };
}

// ── Public parsers ──

export interface ParsedSnapshot {
  snapshot: EventMapSnapshot | null;
  dropped: DroppedCounts;
}

/**
 * @param raw the `data` member of the response envelope.
 *
 * Returns `snapshot: null` — base map intact, no error surfaced — when the
 * payload is unusable or declares a schema other than the one this build reads.
 */
export function parseEventMapSnapshot(raw: unknown): ParsedSnapshot {
  const dropped = emptyDropped();
  const obj = asRecord(raw);
  if (!obj) {
    note(dropped, 'snapshot: not an object');
    return { snapshot: null, dropped };
  }

  // Exact match, not "at most this build's": a version bump is a breaking
  // change, and the last-known-good cache outlives app updates, so the blob a
  // previous build wrote can arrive here too. Accepting an older schema would
  // yield a snapshot whose every item is dropped further down — an event with
  // nothing in it, which is a worse answer than no event.
  const schemaVersion = toFiniteNumber(obj.schemaVersion) ?? 0;
  if (schemaVersion !== EVENTMAP_SCHEMA_VERSION) {
    note(
      dropped,
      `snapshot: schemaVersion ${schemaVersion} is not the ${EVENTMAP_SCHEMA_VERSION} this build reads`,
    );
    return { snapshot: null, dropped };
  }

  const id = asString(obj.id);
  const version = toFiniteNumber(obj.version);
  const campus = asMember(obj.campus, CAMPUSES);
  if (!id || version === null || !campus) {
    note(dropped, 'snapshot: missing id, version or campus');
    return { snapshot: null, dropped };
  }

  const rawSorts = Array.isArray(obj.sorts) ? obj.sorts : [];
  const sorts = rawSorts
    .map((s) => parseSort(s, dropped))
    .filter((s): s is EventMapSort => s !== null);
  dropped.sorts += rawSorts.length - sorts.length;

  const rawTemplates = Array.isArray(obj.cardTemplates) ? obj.cardTemplates : [];
  const cardTemplates = rawTemplates
    .map((t) => parseCardTemplate(t, dropped))
    .filter((t): t is EventMapCardTemplate => t !== null);
  dropped.cardTemplates += rawTemplates.length - cardTemplates.length;

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .map((i) => parseItem(i, dropped))
    .filter((i): i is EventMapItem => i !== null);
  dropped.items += rawItems.length - items.length;

  return {
    snapshot: {
      schemaVersion,
      id,
      version,
      lang: asMember(obj.lang, SUPPORTED_LANGUAGES) ?? 'ko',
      materializedAt: asString(obj.materializedAt) ?? '',
      nextChangeAt: asNullableString(obj.nextChangeAt),
      timezone: asString(obj.timezone) ?? 'Asia/Seoul',
      campus,
      sorts,
      cardTemplates,
      items,
    },
    dropped,
  };
}

/**
 * @param raw the `data` member of the response envelope.
 *
 * Never returns null: a manifest that cannot be read is indistinguishable, for
 * the app's purposes, from one saying there is no active event.
 */
export function parseEventMapManifest(raw: unknown): EventMapManifest {
  const obj = asRecord(raw);
  const inactive: EventMapManifest = {
    schemaVersion: EVENTMAP_SCHEMA_VERSION,
    activeLayerSetId: null,
    version: null,
    snapshotUrl: null,
    refreshAfterSec: 300,
    nextChangeAt: null,
    publishedAt: null,
  };
  if (!obj) return inactive;

  const activeLayerSetId = asNullableString(obj.activeLayerSetId);
  const version = asNullableNumber(obj.version);
  const snapshotUrl = asNullableString(obj.snapshotUrl);
  // All three travel together; a partial set describes nothing fetchable.
  if (!activeLayerSetId || version === null || !snapshotUrl) {
    return {
      ...inactive,
      schemaVersion: toFiniteNumber(obj.schemaVersion) ?? EVENTMAP_SCHEMA_VERSION,
      refreshAfterSec: toFiniteNumber(obj.refreshAfterSec) ?? 300,
    };
  }

  return {
    schemaVersion: toFiniteNumber(obj.schemaVersion) ?? EVENTMAP_SCHEMA_VERSION,
    activeLayerSetId,
    version,
    snapshotUrl,
    refreshAfterSec: toFiniteNumber(obj.refreshAfterSec) ?? 60,
    nextChangeAt: asNullableString(obj.nextChangeAt),
    publishedAt: asNullableString(obj.publishedAt),
  };
}
