/**
 * What a festival place says about itself beyond its pin.
 *
 * The overlay wire (`MapOverlay`) is the SUMMARY: a title, a subtitle, opening
 * hours, flat field rows and buttons. That is enough for a pin and a list row
 * and not enough for the sheet the student council asked for, which needs the
 * operating organisation, an intro with an image, a structured list of
 * representative contents and a menu with prices. None of those exist on the
 * server yet (skkuverse-server `MapPlaceDoc` has no field for any of them, and
 * its importer drops unknown keys), so this type is authored client-first and
 * served from a mock until the server grows the same shape.
 *
 * Kept apart from `MapOverlay` on purpose. The overlay is what the map, the
 * list and the pin-collision ladder already agree on; the detail is read by the
 * sheet alone. Folding it into the overlay would widen a type every renderer
 * touches for the benefit of one screen.
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
 * the medical tent. The kind is what picks the sheet's highlight and its tabs.
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

/** One representative content of a booth — a game, a mission, a giveaway. */
export interface PlaceContent {
  title: I18nText;
  description: I18nText | null;
}

/**
 * One menu line.
 *
 * `price` is a number of won, or `null` when the operator gave a name without a
 * price — which the council's own data sheet allows for pubs. A null price
 * renders as the name alone, never as `0원`.
 */
export interface PlaceMenuItem {
  name: I18nText;
  price: number | null;
  note: I18nText | null;
}

/** A titled run of menu lines — 메인, 사이드, 주류. `title` is null for an untitled list. */
export interface PlaceMenuGroup {
  title: I18nText | null;
  items: PlaceMenuItem[];
}

/** One entry-fee tier, by who is paying. */
export interface PlaceEntryFee {
  label: I18nText;
  price: number;
}

export interface PlaceDetail {
  placeId: string;
  kind: PlaceKind;
  /** The organisation running it — a student council, a club, a sponsor. */
  org: I18nText | null;
  /** A 학생단체협의체 joint booth. The council filters on this. */
  isUnion: boolean;
  /** Where to find it, in words — "102번 부스", "대운동장 구령대 방면". */
  locationLabel: I18nText | null;
  intro: I18nText | null;
  logoUrl: string | null;
  /** Gallery, in authored order. A pub's first image is usually its menu board. */
  images: string[];
  contents: PlaceContent[];
  menu: PlaceMenuGroup[];
  entryFees: PlaceEntryFee[];
  /** Things to know before going — reservations, pickup ID, how to apply. */
  notices: I18nText[];
  paymentMethods: I18nText[];
  instagramUrl: string | null;
}
