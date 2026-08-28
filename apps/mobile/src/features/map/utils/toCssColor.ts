/**
 * `MapLayerStyle.color` arrives as hex *without* a leading `#`.
 *
 * That is the server's convention — the event layers ship `"F04452"` and the
 * commented-out bus polylines `"4CAF50"` — and React Native needs the `#`, so
 * without this the value silently falls back to black, which is exactly the
 * hardcoded colour the field exists to make configurable.
 *
 * Anything that is not bare hex (a named colour, an already-prefixed value)
 * passes through untouched. That pass-through is why this is not
 * `hexToColor` from the bus types, which falls a non-hex value back instead.
 */

/** Bare hex, no `#` — 3, 6 or 8 digits. */
const BARE_HEX_RE = /^[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?$/;

export function toCssColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  return BARE_HEX_RE.test(raw) ? `#${raw}` : raw;
}
