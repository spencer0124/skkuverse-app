/**
 * What a festival place says about itself beyond its pin.
 *
 * The overlay wire (`MapOverlay`) is the SUMMARY: a title, a subtitle, opening
 * hours, flat field rows and buttons. That is enough for a pin and a list row
 * and not enough for the sheet the student council asked for. None of this
 * exists on the server yet (skkuverse-server `MapPlaceDoc` has no field for any
 * of it, and its importer drops unknown keys), so this type is authored
 * client-first and served from a mock until the server grows the same shape.
 *
 * Kept apart from `MapOverlay` on purpose. The overlay is what the map, the
 * list and the pin-collision ladder already agree on; the detail is read by the
 * sheet alone. Folding it into the overlay would widen a type every renderer
 * touches for the benefit of one screen.
 *
 * ## Why the body is blocks
 *
 * The council's requirement sheet names twelve categories, and their bodies
 * have almost nothing in common: a booth wants an introduction and a list of
 * games, a goods shop wants an item/price table plus payment and pickup
 * instructions, a barrier-free zone wants three prose paragraphs, a toilet
 * wants nothing at all. A field per category means a client release every time
 * ops needs a shape the app has not shipped.
 *
 * So the head — the things a machine reads — stays typed, and the body is an
 * ordered list of typed blocks the operator composes. A new category becomes an
 * authoring change rather than a release, and `MapPlaceDoc` grows one field
 * instead of ten.
 *
 * The wire already had a primitive form of this: a `content` MarkerAction
 * carries free text (`daybooth-01`'s reward explainer). Blocks generalise it.
 *
 * Every string is an `I18nText`, the same shape the overlay wire uses, so the
 * eventual server field can be handed over without a translation layer.
 */

import type { I18nText } from './map';

/**
 * What kind of place this is, finer than the layer it is drawn on.
 *
 * The server's `category` cannot say this: promotion booths, the goods shop and
 * day booths all ride the one `booth` layer, and toilets share `facility` with
 * the medical tent.
 *
 * Nothing branches its RENDERING on this — the body is whatever blocks the
 * operator composed, and the summary's highlight is the first one that can fill
 * it. The kind is carried for the list's filters, which the council asked for.
 */
export type PlaceKind =
  | 'pub'
  | 'booth'
  | 'promo'
  | 'foodTruck'
  | 'goods'
  | 'facility'
  | 'stage'
  | 'etc';

// ── Body blocks ───────────────────────────────────────────────────────────

/** One row of a `list` block — a game, a mission, a giveaway. */
export interface PlaceListItem {
  /** One operator-chosen emoji, used as the row's visual marker. */
  emoji: string | null;
  title: I18nText;
  description: I18nText | null;
}

/**
 * One row of a `table` block.
 *
 * `value` is a formatted string rather than a number, because that is how ops
 * already writes it (`5,000원`) and because a table carries prices, times and
 * plain words alike. One way to express a cell beats a number plus a string
 * that say the same thing differently.
 */
export interface PlaceTableRow {
  label: I18nText;
  value: I18nText;
}

/**
 * One block of a place's body.
 *
 * **`type` is an OPEN enum.** A block whose type this build does not know is
 * dropped on its own — never an exhaustive `never` assertion, which would blank
 * a whole body on an older build the moment a new type ships. Same discipline
 * as `OVERLAY_KINDS` on the overlay wire.
 *
 * Style belongs to the type, not to the block: the operator picks which blocks
 * and in what order, never how they look. A per-block styling knob multiplies
 * the design surface by every place that uses it.
 *
 * `title` is the block's optional heading, so a body can read as sections
 * without a separate heading block.
 */
export type PlaceBlock =
  /** A paragraph — an introduction, how to apply, how to pay. */
  | { type: 'text'; id: string; title: I18nText | null; body: I18nText }
  /** Titled rows with an optional emoji and description. */
  | { type: 'list'; id: string; title: I18nText | null; items: PlaceListItem[] }
  /** Label/value rows — an item and its price, a tier and its time. */
  | { type: 'table'; id: string; title: I18nText | null; rows: PlaceTableRow[] }
  /** One image, tappable into the full-screen viewer. A menu board, a logo. */
  | { type: 'image'; id: string; title: I18nText | null; url: string; caption: I18nText | null }
  /** Bulleted things to know before going. */
  | { type: 'notice'; id: string; title: I18nText | null; items: I18nText[] };

/** The block types this build can draw. Anything else is dropped, not thrown. */
export type PlaceBlockType = PlaceBlock['type'];

// ── Actions ───────────────────────────────────────────────────────────────

/**
 * A place's Instagram presence.
 *
 * The profile is always the fallback destination. An authored post or reel is
 * preferred when present, so a booth can send visitors to its announcement
 * rather than only its account.
 */
export interface PlaceInstagramAction {
  type: 'instagram';
  id: string;
  /** The operator-controlled display name, e.g. "인스타" or "행사 공지". */
  label: I18nText;
  profileUrl: string;
  postUrl: string | null;
}

/** A labelled page that always stays inside the app's webview. */
export interface PlaceLinkAction {
  type: 'link';
  id: string;
  label: I18nText;
  url: string;
}

/** The only new sheet-specific action types. Legacy marker actions remain supported. */
export type PlaceAction = PlaceLinkAction | PlaceInstagramAction;

// ── The detail ────────────────────────────────────────────────────────────

export interface PlaceDetail {
  placeId: string;
  /** Carried for the list's filters. Nothing branches its rendering on this. */
  kind: PlaceKind;
  /** The organisation running it — a student council, a club, a sponsor. */
  org: I18nText | null;
  /** A 학생단체협의체 joint booth. The council filters on this. */
  isUnion: boolean;
  /** Where to find it, in words — "102번 부스", "대운동장 구령대 방면". */
  locationLabel: I18nText | null;
  /** Sheet-specific links. Generic map actions stay on `MapOverlay.actions`. */
  actions: PlaceAction[];
  /** The body, in the order the operator composed it. */
  blocks: PlaceBlock[];
}
