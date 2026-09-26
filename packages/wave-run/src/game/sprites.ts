/**
 * Pixel art as strings: one character per art pixel, `.` is transparent, every
 * other character is a palette key (see render/palette.ts). Kept as plain data
 * so the simulation can size hitboxes from the same source the renderer bakes.
 *
 * One art pixel is `PX` logical pixels, so sprites are authored at half the
 * resolution the original runner uses and still land at its sizes.
 */

export const PX = 2;

export interface Box {
  /** Offsets and size in logical px, from the sprite's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Sprite {
  rows: readonly string[];
  /** Logical size. */
  w: number;
  h: number;
}

function sprite(rows: readonly string[]): Sprite {
  const width = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== width) throw new Error(`sprite row width ${row.length} ≠ ${width}: "${row}"`);
  }
  return { rows, w: width * PX, h: rows.length * PX };
}

// ── 은행잎이 ──
// A ginkgo leaf — the university's emblem — with a green ESKARA bandana whose
// tails stream behind it. The first two columns are room for the tails.

const LEAF_TOP = [
  '..KKKKKKK..KKKKKKK',
  '..KHHLLLLKKLLLLHHK',
];
const LEAF_FACE = [
  '..KLLLLLLLLLLLLLLK',
  '..KLLLKLLLLLLKLLLK',
  '..KLLLKLLLLLLKLLLK',
  '...KLPLLLKKLLLPLK.',
  '...KLLLLLLLLLLLLK.',
];
const LEAF_STEM = [
  '....KDLLLLLLLLDK..',
  '....KLDLLLLLLDLK..',
  '.....KLDLLLLDLK...',
  '......KLDLLDLK....',
  '.......KLDDLK.....',
  '........KDDK......',
];

export const PLAYER_RUN: readonly Sprite[] = [
  sprite([
    ...LEAF_TOP,
    'BBKBWBBBBBBBBBBWBK',
    '..' + LEAF_FACE[0]!.slice(2),
    ...LEAF_FACE.slice(1),
    ...LEAF_STEM,
    '.......KK..KK.....',
    '......KK....KK....',
  ]),
  sprite([
    ...LEAF_TOP,
    '.BKBWBBBBBBBBBBWBK',
    'B.' + LEAF_FACE[0]!.slice(2),
    ...LEAF_FACE.slice(1),
    ...LEAF_STEM,
    '........KKKK......',
    '........K..K......',
  ]),
];

export const PLAYER_JUMP = PLAYER_RUN[1]!;

/** Standing still on the title screen: the tails hang down. */
export const PLAYER_IDLE = sprite([
  ...LEAF_TOP,
  '..KBWBBBBBBBBBBWBK',
  '.B' + LEAF_FACE[0]!.slice(2),
  '.B' + LEAF_FACE[1]!.slice(2),
  ...LEAF_FACE.slice(2),
  ...LEAF_STEM,
  '........KKKK......',
  '.......KK..KK.....',
]);

/** Ducking squashes the leaf flat, face forward. */
export const PLAYER_DUCK: readonly Sprite[] = [
  sprite([
    '..KKKKKKKK..KKKKKKKK',
    'BBKBBBWBBBBBBBBWBBBK',
    '.BKLLLLLLLLLLLLLLLLK',
    '..KLLLLKLLLLLLKLLLLK',
    '..KLLPLLLLKKLLLLPLLK',
    '...KDLLLLLLLLLLLLDK.',
    '....KKDDLLLLLLDDKK..',
    '......KKKDDDDKKK....',
    '.....KK........KK...',
  ]),
  sprite([
    '..KKKKKKKK..KKKKKKKK',
    '.BKBBBWBBBBBBBBWBBBK',
    'B.KLLLLLLLLLLLLLLLLK',
    '..KLLLLKLLLLLLKLLLLK',
    '..KLLPLLLLKKLLLLPLLK',
    '...KDLLLLLLLLLLLLDK.',
    '....KKDDLLLLLLDDKK..',
    '......KKKDDDDKKK....',
    '.......KK....KK.....',
  ]),
];

/** Swept by the wave: eyes crossed, mouth open, bandana knocked loose. */
export const PLAYER_CRASH = sprite([
  ...LEAF_TOP,
  '..KBWBBBBBBBBBBWBK',
  '..KLKLKLLLLLLKLKLK',
  '..KLLKLLLLLLLLKLLK',
  '..KLKLKLLLLLLKLKLK',
  '...KLLLLLKKLLLLLK.',
  '...KLLLLKLLKLLLLK.',
  ...LEAF_STEM,
  '.......KK..KK.....',
  '......KK....KK....',
]);

// ── Drawn in code ──
// The waves and the bus are regular shapes, so they are generated rather than
// typed out: a grid, filled, then outlined.

type Grid = string[][];

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string>(w).fill('.'));
}

function fill(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy]?.[xx] !== undefined) g[yy]![xx] = c;
}

/** Ring every filled pixel with outline where it borders transparency. */
function outline(g: Grid): string[] {
  const out = g.map((row) => [...row]);
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c !== '.') return;
      const near = [g[y - 1]?.[x], g[y + 1]?.[x], row[x - 1], row[x + 1]];
      if (near.some((n) => n !== undefined && n !== '.')) out[y]![x] = 'K';
    }),
  );
  return out.map((row) => row.join(''));
}

// ── 파도 ──
// Waves are generated so a group is one body of water with several curls, not
// the same sprite stood side by side (which reads as a row of cacti). Each
// crest is the 🌊 shape: a ring of water curling over the top toward the runner
// around an open barrel, with the face rising beneath the barrel and a long
// back sloping away. Foam rims the curl; spray and whitewater flicker between
// the two frames.

interface Curl {
  /** Ring radii, in art pixels. */
  R: number;
  r: number;
  /** Height of the barrel's centre above the base. */
  cy: number;
  /** Columns between neighbouring curls in a group. */
  spacing: number;
  /** Columns the back slopes down over after the last curl. */
  tail: number;
}

const WASH = 3;

/** Frames in a wave's motion loop. */
export const WAVE_FRAMES = 4;

function waveRows(n: number, c: Curl, frame: number): string[] {
  // The loop: the curl breathes (swells, rises, settles) and small ripples roll
  // back along the water's surface, one quarter-turn per frame.
  const phase = (frame / WAVE_FRAMES) * Math.PI * 2;
  const R = c.R + 0.45 * Math.sin(phase);
  const cy = c.cy + 0.4 * Math.sin(phase);
  const ripple = (x: number) => 0.9 * Math.sin(x * 0.75 + phase);

  const lipReach = Math.ceil(c.R * 0.8) + 1;
  const H = Math.ceil(c.cy + c.R + 1) + 2;
  const W = 1 + WASH + lipReach + Math.ceil(c.R) + (n - 1) * c.spacing + c.tail + 3;
  const g = grid(W, H);
  const base = H - 2;
  const centres = Array.from({ length: n }, (_, k) => 1 + WASH + lipReach + k * c.spacing);
  const lastX = centres[n - 1]! + R;

  // The face rises diagonally from the front toward the back of the barrel, so
  // the barrel stays open to the front under the falling lip.
  const faceTop = (dx: number) => 1 + ((dx + R * 0.9) / (R * 1.4)) * (cy - c.r * 0.3 - 1);

  const at = (x: number, y: number) => {
    const px = x + 0.5;
    const h = base - y + 0.5; // height above the base
    const w = ripple(px);
    let water = h <= 2 + w * 0.6 && px >= centres[0]! - R * 0.9 && px <= lastX; // the swell under a group
    let hollow = false;
    let rim = false; // outer edge of a curl, for foam
    let inner = false; // inside edge of a curl
    let swirl = false;
    for (const cx of centres) {
      const dx = px - cx;
      const dy = h - cy;
      const d = Math.hypot(dx, dy);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (d < c.r) hollow = true;
      // From the back, low on the right, over the top, to the lip just below
      // level on the left.
      const inArc = ang >= -60 || ang <= -160;
      if (d >= c.r && d <= R && inArc) {
        water = true;
        if (d > R - 1.1 && ang > 35) rim = true;
        if (d < c.r + 1) inner = true;
        // The swirl line inside the curl turns with the loop.
        const turn = (ang + frame * 25) % 60;
        if (d > R - 2.6 && d < R - 1.7 && ang > 0 && ang < 170 && turn < 42) swirl = true;
      }
      if (dx >= 0 && dx <= R && d > R && dy < 0) water = true; // under the back of the ring
      if (dx >= -R * 0.9 && dx <= R * 0.5 && h <= faceTop(dx) + w * 0.5) water = true; // the face
    }
    // The back slope after the last curl, rippling.
    if (px > lastX && px < lastX + c.tail && h <= cy * (1 - (px - lastX) / c.tail) + w) water = true;
    if (hollow) water = false;
    return { water, rim, inner, swirl, h };
  };

  for (let y = 0; y <= base; y++) {
    for (let x = 0; x < W; x++) {
      const p = at(x, y);
      if (!p.water) continue;
      // Surface glints travel with the ripples on the non-curl water.
      const glint = !p.rim && !p.inner && g[y - 1]?.[x] === '.' && Math.sin(x * 0.75 + phase) > 0.6;
      g[y]![x] = p.rim || glint ? 'W' : p.inner || p.swirl ? 'S' : p.h < c.cy * 0.3 ? 'D' : 'A';
    }
  }

  // Foam fingers off each lip, reaching and pulling back through the loop.
  const fingers = [
    [[-1, 0], [-1, 1], [0, 1]],
    [[-1, 0], [-2, 1], [0, 1]],
    [[-1, 0], [-2, 1], [-1, 2]],
    [[-1, 0], [-1, 1], [-1, 2]],
  ] as const;
  for (const cx of centres) {
    const tipX = Math.round(cx - R * 0.77);
    const tipY = base - Math.round(cy - R * 0.64);
    for (const [dx, dy] of fingers[frame]!) if (g[tipY + dy]?.[tipX + dx] === '.') g[tipY + dy]![tipX + dx] = 'W';
  }

  // Whitewater running out ahead of the first face, churning.
  for (let x = 1; x < centres[0]! - Math.ceil(R * 0.8); x++) {
    g[base]![x] = (x + frame) % 2 ? 'W' : 'S';
    if ((x + frame) % 4 === 0) g[base - 1]![x] = 'W';
  }
  return outline(g);
}

/**
 * Boxes per four columns around the water, skipping the open barrel and the
 * spray: the run standing on the base, and the curl above the barrel where a
 * column has one. Foam at ground level is too low to count.
 */
function waterBoxes(sp: Sprite): Box[] {
  const rows = sp.rows;
  const H = rows.length;
  const W = rows[0]!.length;
  const isWater = (x: number, y: number) => {
    const c = rows[y]![x]!;
    return c !== '.' && c !== 'K' && c !== 'w';
  };
  /** Runs of water in a column, bottom first, as [top row, bottom row]. */
  const runs = (x: number) => {
    const out: [number, number][] = [];
    let end = -1;
    for (let y = H - 1; y >= -1; y--) {
      const w = y >= 0 && isWater(x, y);
      if (w && end < 0) end = y;
      if (!w && end >= 0) {
        out.push([y + 1, end]);
        end = -1;
      }
    }
    return out;
  };
  const boxes: Box[] = [];
  const onBase = (r: [number, number][]) => r[0] !== undefined && r[0][1] >= H - 3;
  // The body on the base, four columns at a time.
  for (let x = 0; x < W; x += 4) {
    let top = Infinity;
    for (let i = x; i < Math.min(x + 4, W); i++) {
      const r = runs(i);
      if (onBase(r)) top = Math.min(top, r[0]![0]);
    }
    if (top < Infinity && H - 1 - top >= 3) boxes.push({ x: x * PX + 1, y: top * PX + 2, w: 4 * PX - 2, h: (H - 1 - top) * PX - 2 });
  }
  // The curl above a barrel, two columns at a time: it runs diagonally, and a
  // wider box would take in the open air beside it.
  for (let x = 0; x < W; x += 2) {
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = x; i < Math.min(x + 2, W); i++) {
      const r = runs(i);
      for (const run of onBase(r) ? r.slice(1) : r) {
        top = Math.min(top, run[0]);
        bottom = Math.max(bottom, run[1]);
      }
    }
    if (top < Infinity) boxes.push({ x: x * PX + 1, y: top * PX + 2, w: 2 * PX - 2, h: (bottom - top + 1) * PX - 3 });
  }
  return boxes;
}

export interface WaveArt {
  /** [group size - 1][frame] */
  sprites: readonly (readonly Sprite[])[];
  /** [group size - 1] */
  boxes: readonly (readonly Box[])[];
  /**
   * [group size - 1]: where spray leaves each crest, in logical px — x from the
   * sprite's left edge, y as height above its bottom edge.
   */
  crests: readonly (readonly { x: number; y: number }[])[];
}

function waveArt(curl: Curl): WaveArt {
  const sizes = [1, 2, 3];
  const sprites = sizes.map((n) => Array.from({ length: WAVE_FRAMES }, (_, f) => sprite(waveRows(n, curl, f))));
  const lipReach = Math.ceil(curl.R * 0.8) + 1;
  const crests = sizes.map((n) =>
    Array.from({ length: n }, (_, k) => ({
      x: (1 + WASH + lipReach + k * curl.spacing - curl.R * 0.3) * PX,
      y: (curl.cy + curl.R + 1) * PX,
    })),
  );
  return { sprites, boxes: sprites.map((frames) => waterBoxes(frames[0]!)), crests };
}

/** 잔물결: a small breaker. */
export const RIPPLE = waveArt({ R: 5.5, r: 2.4, cy: 6, spacing: 11, tail: 5 });
/** 큰 파도: a tall one. */
export const BIG_WAVE = waveArt({ R: 9, r: 4.2, cy: 11, spacing: 17, tail: 7 });

// ── 인자셔틀 ──
// The inter-campus shuttle in the pterodactyl's place: a gull-sized coach, sky
// blue with a route board in the windscreen, flying at the runner nose first on
// a pair of little wings that flap — raised, then level and dipping behind.
// The wheels turn in step.

function busRows(frame: 0 | 1): string[] {
  const g = grid(28, 14);
  fill(g, 1, 4, 22, 7, 'S'); // body
  fill(g, 1, 4, 3, 1, 'N'); // route board: 인사캠 ↔ 자과캠
  fill(g, 1, 5, 3, 4, 'Q'); // windscreen
  fill(g, 2, 6, 1, 2, 'q'); // glare
  for (let x = 6; x < 22; x += 4) fill(g, x, 5, 3, 2, 'Q'); // side windows
  fill(g, 1, 8, 22, 1, 'B'); // blue band
  for (let x = 1; x < 23; x++) fill(g, x, 9, 1, 1, x % 3 === 0 ? 'Y' : 'O'); // swoosh
  fill(g, 1, 10, 22, 1, 'D'); // skirt
  fill(g, 1, 9, 1, 1, 'H'); // headlight
  for (const cx of [6, 18]) {
    fill(g, cx - 1, 10, 3, 3, 'K'); // wheels
    fill(g, frame === 0 ? cx : cx - 1, 11, 1, 1, 'h'); // hub, turning
  }
  if (frame === 0) {
    // Wings raised.
    fill(g, 11, 3, 5, 1, 'W');
    fill(g, 13, 2, 5, 1, 'W');
    fill(g, 15, 1, 5, 1, 'W');
    fill(g, 17, 0, 3, 1, 'W');
  } else {
    // Wings level, tips dipping past the tail.
    fill(g, 11, 3, 15, 1, 'W');
    fill(g, 12, 2, 4, 1, 'W');
    fill(g, 24, 4, 3, 1, 'W');
  }
  return outline(g);
}

export const BUS: readonly Sprite[] = [sprite(busRows(0)), sprite(busRows(1))];

// ── Hitboxes ──
// Smaller than the art on purpose: a graze that looks like a miss should be one.

export const PLAYER_RUN_BOXES: readonly Box[] = [
  { x: 8, y: 2, w: 26, h: 14 },
  { x: 12, y: 16, w: 18, h: 8 },
  { x: 14, y: 24, w: 10, h: 8 },
];
export const PLAYER_DUCK_BOXES: readonly Box[] = [
  { x: 6, y: 2, w: 32, h: 10 },
  { x: 12, y: 12, w: 18, h: 4 },
];
/** Body and wheels; the wings are left out, as the original leaves out the pterodactyl's. */
export const BUS_BOXES: readonly Box[] = [
  { x: 4, y: 9, w: 40, h: 10 },
  { x: 8, y: 19, w: 32, h: 5 },
];
