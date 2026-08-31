/**
 * Where a sheet can sit, and what that means.
 *
 * Three named positions replace the ten different percentages the app used to
 * carry. The names are the vocabulary the rest of the system is built on: the
 * surface a sheet gets is decided by which detent it is at, not by whether it
 * can be dragged, so `large` is the one that means something beyond its height.
 *
 * ## `large` is not a percentage
 *
 * `small` and `medium` are fractions of the sheet's container. `large` is
 * "attached to the top safe area" — the sheet has arrived, it fills the screen,
 * and it stops being a floating card. Expressing it as a measurement rather
 * than a percentage is what lets one definition cover a modal portalled to the
 * window and an inline sheet living inside a screen's root view.
 *
 * Pure and import-free so it runs under plain `node --test`.
 */

/** The three positions a sheet is encouraged to use. */
export type SheetDetent = 'small' | 'medium' | 'large';

export type SheetPosition =
  /**
   * Draggable between two or three detents. `initial` defaults to the lowest.
   *
   * The tuple type is what makes "expandable needs at least two detents" a
   * compile error rather than a sheet that silently cannot move. Order them
   * low to high; gorhom requires ascending snap points and does not sort.
   */
  | {
      kind: 'expandable';
      detents: readonly [SheetDetent, SheetDetent, ...SheetDetent[]];
      initial?: SheetDetent;
      /**
       * Per-detent height overrides, for a sheet whose low detents are load
       * bearing somewhere else on the screen.
       *
       * The named detents survive the override, which is the point: the sheet
       * still says `small / medium / large`, so it still gets the surface its
       * position earns and a reader still knows what it is. Only the two
       * fractional heights can be overridden — `large` means "attached", not a
       * number, and letting it be one would break the rule the whole system
       * rests on.
       */
      heights?: Partial<Record<'small' | 'medium', string | number>>;
    }
  /** One fixed height, no drag. The encouraged stuck form. */
  | { kind: 'stuck'; detent: SheetDetent }
  /**
   * One fixed height that is not a named detent.
   *
   * Deliberately a variant deeper than `detent`, so the named form is what
   * autocomplete offers first. A custom height is never treated as `large`,
   * whatever its value — it floats, and on a glass sheet it stays a card.
   */
  | { kind: 'stuck'; height: string | number }
  /** Height follows the content. */
  | { kind: 'fit' };

/**
 * `small` and `medium` as percentages of the sheet's container.
 *
 * These are the centroids of the clusters the app had already converged on by
 * hand — 38/45/45/50 and 50/62/72 — rather than round numbers picked fresh, so
 * migrating an existing sheet moves it as little as possible.
 */
export const SHEET_DETENT_PERCENT: Readonly<Record<'small' | 'medium', number>> = {
  small: 45,
  medium: 65,
};

/**
 * `large` before the container has been measured.
 *
 * A percentage, unlike the real one, because there is nothing yet to subtract a
 * safe area from. Close enough that the one frame it survives is not a jump.
 */
export const SHEET_LARGE_PERCENT_FALLBACK = 92;

/**
 * One detent as a gorhom snap point.
 *
 * `largeHeight` is the container's height less the top safe area, or null while
 * either is still unknown.
 */
export function detentSnapPoint(
  detent: SheetDetent,
  largeHeight: number | null,
  overrides?: Partial<Record<'small' | 'medium', string | number>>,
): string | number {
  if (detent === 'large') {
    return largeHeight != null && largeHeight > 0
      ? largeHeight
      : `${SHEET_LARGE_PERCENT_FALLBACK}%`;
  }
  return overrides?.[detent] ?? `${SHEET_DETENT_PERCENT[detent]}%`;
}

export interface ResolvedSheetPosition {
  /** gorhom's `snapPoints`. Undefined only for a content-sized sheet. */
  snapPoints: (string | number)[] | undefined;
  enableDynamicSizing: boolean;
  /** Which snap point the sheet opens at. */
  initialIndex: number;
  /** `snapPoints.length - 1`, or 0 for a content-sized sheet. */
  lastIndex: number;
  /**
   * True when the top detent is `large`.
   *
   * The single most load-bearing bit in this module. A sheet that attaches has
   * to travel from a floating card to a full-bleed surface, which is the only
   * case needing interpolation; every other sheet keeps one shape and can be
   * handed to gorhom's own `detached` mode.
   */
  attachesAtTop: boolean;
  /**
   * Whether there is more than one detent to move between.
   *
   * NOT the same question as "can the user swipe it away". A stuck sheet has
   * nowhere to travel and still closes on a downward swipe — that is the
   * `dismissible` prop's business, and conflating the two is how eight sheets
   * would silently lose swipe-to-dismiss.
   */
  movesBetweenDetents: boolean;
}

/** What a `SheetPosition` means to gorhom. */
export function resolveSheetPosition(
  position: SheetPosition,
  largeHeight: number | null,
): ResolvedSheetPosition {
  if (position.kind === 'fit') {
    return {
      snapPoints: undefined,
      enableDynamicSizing: true,
      initialIndex: 0,
      lastIndex: 0,
      // A sheet sized to its content is as tall as it needs to be and no
      // taller, so it never fills the screen and never attaches.
      attachesAtTop: false,
      movesBetweenDetents: false,
    };
  }

  if (position.kind === 'stuck') {
    return {
      snapPoints: [
        'detent' in position
          ? detentSnapPoint(position.detent, largeHeight)
          : position.height,
      ],
      enableDynamicSizing: false,
      initialIndex: 0,
      lastIndex: 0,
      attachesAtTop: 'detent' in position && position.detent === 'large',
      movesBetweenDetents: false,
    };
  }

  const { detents, initial, heights } = position;
  // An `initial` outside `detents` is a programming error the type system
  // cannot catch, since the two are independent. Opening at the lowest detent
  // is the harmless answer — the sheet is visible and the user can drag.
  const requested = initial != null ? detents.indexOf(initial) : 0;
  return {
    snapPoints: detents.map((d) => detentSnapPoint(d, largeHeight, heights)),
    enableDynamicSizing: false,
    initialIndex: requested === -1 ? 0 : requested,
    lastIndex: detents.length - 1,
    attachesAtTop: detents[detents.length - 1] === 'large',
    movesBetweenDetents: true,
  };
}
