/**
 * Colors, taken from the 2026 ESKARA: 초록의 파도 posters (@skku_eskara): a deep
 * emerald ground, a vivid green, lime highlights and a mint white. The poster
 * line — countless lights gathering into one green wave — is what the night sky
 * draws.
 */
export const BRAND = {
  deep: '#073E32',
  deep2: '#0B5542',
  green: '#18A866',
  lime: '#9BEA65',
  lime2: '#C7F37A',
  mint: '#F2F8E9',
  ink: '#062B22',
} as const;

export type Palette = Readonly<Record<string, string>>;

/** An autumn ginkgo leaf: yellow, with a green ESKARA bandana. */
export const PLAYER_PALETTE: Palette = {
  K: BRAND.ink,
  L: '#F9CF3A',
  H: '#FFE98C',
  D: '#DB9A12',
  B: '#0E7A55',
  W: BRAND.mint,
  P: '#FF8FA3',
};

/** Water, outlined in deep green rather than ink so a wave reads soft, not spiky. */
export const WAVE_PALETTE: Palette = {
  K: BRAND.deep2,
  A: BRAND.green,
  D: '#0E7A55',
  S: '#7FE3AA',
  W: BRAND.mint,
};

export const BUS_PALETTE: Palette = {
  K: '#1B2A33',
  S: '#A9DDF3',
  Q: '#27485A',
  q: '#7FB3C8',
  N: BRAND.green,
  W: '#FFFFFF',
  B: '#2F68B3',
  O: '#F28C28',
  Y: '#FFD23F',
  k: '#80B9D0',
  D: '#3A4852',
  H: '#FFF6C2',
  R: '#E8413A',
  h: '#C8D2D6',
};

/** Two frames of the scene: noon and the night show. `mix` blends between them. */
export const SKY = {
  day: { top: '#C9EFD6', bottom: '#F2F8E9' },
  night: { top: '#021A14', bottom: '#0B5542' },
};
export const FIELD = {
  day: { top: '#3E9E62', bottom: '#27704A' },
  night: { top: '#0A3A2E', bottom: '#03211A' },
};
export const GROUND_LINE = { day: BRAND.deep2, night: BRAND.lime };
export const SKYLINE = { day: '#A9DCBA', night: '#0D4A39' };
export const SKYLINE_DETAIL = { day: '#93CFA7', night: '#11573F' };
export const LIGHT_DOT = { day: BRAND.green, night: BRAND.lime2 };
/** Back row to front: the nearer the row, the darker, so heads stand out against the row behind. */
export const CROWD = [
  { day: '#56B378', night: '#0C3E30' },
  { day: '#3C9562', night: '#08301F' },
  { day: '#236F47', night: '#041E16' },
] as const;
export const HUD_TEXT = { day: BRAND.deep2, night: BRAND.mint };

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear blend of two hex colors; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function phase(pair: { day: string; night: string }, night: number): string {
  return mix(pair.day, pair.night, night);
}
