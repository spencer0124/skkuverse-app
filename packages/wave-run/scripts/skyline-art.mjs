// Draws the campus landmarks on the horizon as pixel art and writes them to
// src/assets/skyline/ as PNGs, one for day and one for night.
//
//   pnpm art
//
// The PNGs are the assets the game loads; this script is only how the first
// version of them was made. A designer can replace a PNG outright — keep the
// size (or change SKYLINE_ART in render/skyline.ts) and the day/night pair.
//
// Both buildings are simplified from photos: the shape has to read at 60 px
// tall behind the booths, not survive close inspection.

import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/skyline');

// ── Pixel grid ──

function canvas(w, h) {
  const px = Array.from({ length: h }, () => Array(w).fill('.'));
  const set = (x, y, c) => {
    if (x >= 0 && x < w && y >= 0 && y < h) px[y][x] = c;
  };
  const rect = (x, y, rw, rh, c) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) set(xx, yy, c);
  };
  return { w, h, px, set, rect };
}

/** Deterministic noise for window lights and leaf texture. */
function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ── 삼성학술정보관 (자과캠) ──
// SAMOO, 2009: "책이 펼쳐지는 연속적인 이미지" — a book opening, page after page.
// From the front, five thick metal roof slabs step down and out, three tiers a
// side: the top one rolls under at both ends, the middle pair roll under at the
// outer end, the lowest pair thicken toward their outer tips. A glass atrium
// with a diagonal lattice fills the centre; the wings are banded glass; an
// arched canopy on slim silver columns runs across the middle of the ground
// floor. Proportions are taken from the front elevation at night.

function library() {
  const W = 75;
  const c = canvas(W, 28);
  const C = 37; // centre column; only the left half is drawn, then mirrored
  const X = (dx) => C + dx;

  // Banded wing glass; `lattice` draws the atrium's diagonal grid instead.
  const glass = (dx0, dx1, y0, y1, lattice) => {
    for (let y = y0; y <= y1; y++) {
      for (let dx = dx0; dx <= dx1; dx++) {
        const x = X(dx);
        const lit = hash(Math.floor(dx / 3), Math.floor(y / 2)) > 0.3;
        let ch = lit ? 'G' : 'u';
        if (lattice) {
          const m = (n) => ((n % 6) + 6) % 6;
          ch = m(dx + y) === 0 || m(dx - y) === 0 ? 'M' : 'a';
        } else if ((y - y0) % 3 === 2) ch = 'm';
        c.set(x, y, ch);
      }
    }
  };
  // A roof slab over [dx0, dx1] from row y, `thick` rows deep: a light top
  // edge, the silver fascia, a dark underside.
  const slab = (dx0, dx1, y, thick) => {
    for (let dx = dx0; dx <= dx1; dx++) {
      const t = typeof thick === 'function' ? thick(dx) : thick;
      for (let i = 0; i < t; i++) c.set(X(dx), y + i, i === 0 ? 'T' : i === t - 1 ? 'r' : 'R');
    }
  };
  // The rolled end of a slab at column dx: the fascia wraps down and under.
  const roll = (dx, y, depth) => {
    c.rect(X(dx), y + 1, 1, depth - 1, 'R');
    c.rect(X(dx + 1), y, 1, depth, 'R');
    c.set(X(dx + 1), y + depth, 'r');
    c.set(X(dx + 2), y + depth, 'r');
    c.set(X(dx + 2), y + depth - 1, 'r');
  };

  // Back to front.
  glass(-33, -23, 16, 27, false); // outer wings
  slab(-36, -22, 12, (dx) => 3 + Math.round(((-22 - dx) / 14) * 2)); // lowest roofs, thickening outward
  glass(-27, -11, 10, 20, false); // middle wings
  slab(-28, -10, 6, 4);
  roll(-29, 6, 6);
  glass(-19, 0, 4, 19, true); // central atrium
  slab(-20, 0, 0, 4);
  roll(-21, 0, 6);

  // Ground floor: an arched canopy on slim columns, the entrance behind it.
  glass(-25, 0, 21, 27, false);
  for (let dx = -26; dx <= 0; dx++) {
    const y = dx < -18 ? 20 : 19;
    c.set(X(dx), y, 'C');
    c.set(X(dx), y + 1, 'r');
  }
  for (const dx of [-24, -18, -12, -6]) c.rect(X(dx), 21, 1, 7, 'P');
  c.rect(X(-3), 22, 4, 6, 'E');

  // Mirror the left half onto the right.
  for (let y = 0; y < c.h; y++) for (let x = 0; x < C; x++) c.px[y][W - 1 - x] = c.px[y][x];

  c.rect(X(-10), 23, 4, 1, 'N'); // the name sign, left of the entrance
  return c;
}

const LIBRARY_DAY = {
  T: '#F4F7F8', R: '#C9D3D7', r: '#6F8189', G: '#9DC3D2', u: '#7FA7B8', m: '#6E93A3',
  a: '#A7CCDA', M: '#E3EEF2',
  C: '#EEF2F3', P: '#DDE4E6', E: '#4F6670', N: '#FFFFFF',
};
// At night the glass is lit from inside and the lattice glows gold.
const LIBRARY_NIGHT = {
  T: '#8C9CA2', R: '#55656B', r: '#1E2A2E', G: '#E6BC62', u: '#324650', m: '#2A3940',
  a: '#2C4757', M: '#FFD877',
  C: '#A9B6BA', P: '#C9D1D4', E: '#FFF0B5', N: '#FFFFFF',
};

// ── 명륜당 (인사캠, 성균관 문묘) ──
// A long, low hanok on a granite platform: a taller gabled centre hall of three
// bays between two lower hipped wings of three bays each. Red columns, teal
// doors, a dancheong band under the eaves, blue-grey tiles, the 明倫堂 plaque —
// and in front, the two great ginkgo trees, in autumn gold.

function myeongnyundang() {
  const c = canvas(80, 40);

  // Platform and centre steps.
  c.rect(6, 33, 68, 7, 'S');
  for (let y = 35; y < 40; y += 2) c.rect(6, y, 68, 1, 's');
  for (let i = 0; i < 6; i++) c.rect(34 - i, 34 + i, 12 + i * 2, 1, i % 2 ? 's' : 'S');

  // A tiled roof whose eave spans [x0, x1] at row `eave`, rising `h` rows to
  // the ridge, with the eave tips turned up.
  const roof = (x0, x1, eave, h, inset) => {
    for (let i = 0; i < h; i++) {
      const y = eave - i;
      const a = x0 + Math.round((i * inset) / h);
      const b = x1 - Math.round((i * inset) / h);
      for (let x = a; x <= b; x++) c.set(x, y, (x - a) % 2 ? 'r' : 'R');
    }
    const ridgeY = eave - h;
    const a = x0 + inset;
    const b = x1 - inset;
    c.rect(a, ridgeY, b - a + 1, 1, 'K');
    c.set(a - 1, ridgeY - 1, 'K');
    c.set(b + 1, ridgeY - 1, 'K');
    c.set(x0 - 1, eave - 1, 'R');
    c.set(x1 + 1, eave - 1, 'R');
  };

  // A run of bays: columns at each boundary, a teal door in each bay.
  const hall = (x0, x1, bays, top) => {
    c.rect(x0, top, x1 - x0 + 1, 32 - top + 1, 'W');
    c.rect(x0, top, x1 - x0 + 1, 1, 'D');
    for (let x = x0; x <= x1; x++) if (x % 3 === 0) c.set(x, top, 'd');
    const bay = (x1 - x0) / bays;
    for (let i = 0; i <= bays; i++) c.rect(Math.round(x0 + i * bay), top + 1, 1, 32 - top, 'C');
    for (let i = 0; i < bays; i++) {
      const mid = Math.round(x0 + (i + 0.5) * bay);
      c.rect(mid - 1, top + 3, 3, 32 - top - 3, 'T');
    }
  };

  hall(10, 26, 3, 24);
  hall(53, 69, 3, 24);
  roof(6, 30, 23, 5, 5);
  roof(49, 73, 23, 5, 5);
  hall(26, 53, 3, 23);
  roof(21, 58, 22, 8, 5);
  c.rect(35, 24, 10, 2, 'P'); // 明倫堂
  for (const x of [37, 39, 42]) c.set(x, 24, 'p');

  // The ginkgo trees: trunk, then a crown of noisy gold, lit from the upper left.
  const tree = (cx, cy, r, trunkX) => {
    c.rect(trunkX, cy, 4, 40 - cy, 'B');
    c.rect(trunkX + 3, cy, 1, 40 - cy, 'b');
    c.rect(trunkX - 1, 38, 6, 2, 'B');
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r - 2; x <= cx + r + 2; x++) {
        const dx = (x - cx) / (r + 2);
        const dy = (y - cy) / r;
        const d = dx * dx + dy * dy;
        const n = hash(x, y);
        if (d > 1 || (d > 0.75 && n < 0.45)) continue;
        c.set(x, y, dx + dy < -0.6 && n > 0.3 ? 'h' : dx + dy > 0.5 && n > 0.25 ? 'y' : n < 0.08 ? 'y' : 'Y');
      }
    }
  };
  tree(9, 13, 11, 7);
  tree(71, 12, 11, 69);

  return c;
}

const MYEONG_DAY = {
  R: '#94A1BB', r: '#8190AE', K: '#5B6781', D: '#78B4A9', d: '#CE8474', C: '#D2775F',
  W: '#BD7A66', T: '#86BDB3', S: '#D9DCD8', s: '#BDC1BC', P: '#6E4F3D', p: '#EDE0C4',
  Y: '#F4CD4A', y: '#DDAA2C', h: '#FBE48C', B: '#8C6C51', b: '#6F543E',
};
// Night: the doors glow, the gold goes to amber.
const MYEONG_NIGHT = {
  R: '#2B3349', r: '#242B3E', K: '#151A27', D: '#2C514C', d: '#643831', C: '#733629',
  W: '#452721', T: '#F0C46A', S: '#474B49', s: '#393D3B', P: '#271B15', p: '#C7A763',
  Y: '#A1802A', y: '#7C611B', h: '#C19E3B', B: '#382A20', b: '#2A1F18',
};

// ── PNG ──

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png({ w, h, px }, palette) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const hex = palette[px[y][x]];
      const o = y * (w * 4 + 1) + 1 + x * 4;
      if (!hex) continue; // transparent
      const n = parseInt(hex.slice(1), 16);
      raw[o] = n >> 16;
      raw[o + 1] = (n >> 8) & 255;
      raw[o + 2] = n & 255;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
const art = [
  ['samsung-library', library(), LIBRARY_DAY, LIBRARY_NIGHT],
  ['myeongnyundang', myeongnyundang(), MYEONG_DAY, MYEONG_NIGHT],
];
for (const [name, grid, day, night] of art) {
  const unknown = new Set(grid.px.flat().filter((ch) => ch !== '.' && !(ch in day && ch in night)));
  if (unknown.size) throw new Error(`${name}: no color for ${[...unknown].join(', ')}`);
  writeFileSync(join(OUT, `${name}-day.png`), png(grid, day));
  writeFileSync(join(OUT, `${name}-night.png`), png(grid, night));
  console.log(`${name}: ${grid.w}×${grid.h}`);
}
