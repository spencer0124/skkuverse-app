import { VIEW_HEIGHT } from '../constants';
import { nextRandom } from '../rng';
import type { Layout } from './layout';
import { BRAND, CROWD, FIELD, GROUND_LINE, LIGHT_DOT, SKY, SKYLINE, SKYLINE_DETAIL, phase } from './palette';

// ── Sky ──

export function drawSky(ctx: CanvasRenderingContext2D, L: Layout, night: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, L.groundY);
  g.addColorStop(0, phase({ day: SKY.day.top, night: SKY.night.top }, night));
  g.addColorStop(1, phase({ day: SKY.day.bottom, night: SKY.night.bottom }, night));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.groundY);
}

// ── 빛의 물결: the poster's lights gathering into a green wave ──

export interface Dot {
  band: number;
  /** Position along the band, 0–1. */
  u: number;
  /** In art pixels. */
  size: 1 | 2;
  twinkle: number;
  rate: number;
  /** Scatter off the band's centre line, -1–1. */
  jitter: number;
}

const BANDS = 3;

export function makeDots(count: number): Dot[] {
  const rng = { rng: 0x5eed };
  return Array.from({ length: count }, () => ({
    band: Math.floor(nextRandom(rng) * BANDS),
    u: nextRandom(rng),
    size: nextRandom(rng) < 0.25 ? 2 : 1,
    twinkle: nextRandom(rng) * Math.PI * 2,
    rate: 1 + nextRandom(rng) * 2.5,
    jitter: nextRandom(rng) * 2 - 1,
  }));
}

let glowSprite: HTMLCanvasElement | null = null;

function glow(): HTMLCanvasElement {
  if (glowSprite) return glowSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(199,243,122,0.9)');
  g.addColorStop(0.35, 'rgba(155,234,101,0.35)');
  g.addColorStop(1, 'rgba(155,234,101,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  glowSprite = c;
  return c;
}

export function drawLightWaves(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  dots: readonly Dot[],
  night: number,
  t: number,
  scroll: number,
): void {
  const top = L.h * 0.07;
  const bottom = L.groundY - VIEW_HEIGHT * L.scale * 0.55;
  const span = bottom - top;
  const color = phase(LIGHT_DOT, night);
  const g = glow();

  for (const d of dots) {
    const base = top + (span * (d.band + 0.5)) / BANDS;
    const amp = span * (0.07 + 0.03 * d.band);
    const drift = scroll * L.scale * (0.05 + 0.03 * d.band) + t * 8;
    const x = (((d.u * L.w - drift) % L.w) + L.w) % L.w;
    const y = base + amp * Math.sin((x / L.w) * Math.PI * 3 + t * 0.7 + d.band * 1.7) + d.jitter * span * 0.015;
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * d.rate + d.twinkle));
    const s = L.pixel * d.size;

    if (night > 0) {
      const gs = s * 7;
      ctx.globalAlpha = a * night * 0.55;
      ctx.drawImage(g, x - gs / 2, y - gs / 2, gs, gs);
    }
    ctx.globalAlpha = a * (0.45 + 0.55 * night);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  }
  ctx.globalAlpha = 1;
}

// ── Festival skyline: booths and the main stage on the horizon ──

const SKYLINE_TILE = 640;

/** Staircase roof, so the booths stay pixel-shaped at any scale. */
function tent(ctx: CanvasRenderingContext2D, x: number, base: number, u: number, w: number, h: number, detail: string, body: string): void {
  ctx.fillStyle = body;
  ctx.fillRect(x, base - h * u, w * u, h * u);
  ctx.fillStyle = detail;
  for (let sx = 0; sx < w; sx += 12) ctx.fillRect(x + sx * u, base - h * u, 6 * u, h * u * 0.35);
  ctx.fillStyle = body;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const inset = (i * (w + 8)) / (steps * 2);
    ctx.fillRect(x - 4 * u + inset * u, base - (h + (i + 1) * 2) * u, (w + 8 - inset * 2) * u, 2 * u);
  }
}

function stage(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  u: number,
  body: string,
  detail: string,
  night: number,
  t: number,
): void {
  const w = 150;
  ctx.fillStyle = body;
  ctx.fillRect(x, base - 14 * u, w * u, 14 * u); // deck
  ctx.fillRect(x + 6 * u, base - 84 * u, 6 * u, 84 * u); // truss towers
  ctx.fillRect(x + (w - 12) * u, base - 84 * u, 6 * u, 84 * u);
  ctx.fillRect(x + 6 * u, base - 84 * u, (w - 12) * u, 6 * u); // top beam
  ctx.fillStyle = detail;
  ctx.fillRect(x + 16 * u, base - 40 * u, 14 * u, 26 * u); // speakers
  ctx.fillRect(x + (w - 30) * u, base - 40 * u, 14 * u, 26 * u);
  for (let i = 0; i < 12; i++) ctx.fillRect(x + (9 + i * 6) * u, base - 82 * u, 2 * u, 2 * u);

  // The night show: beams sweep from the lighting rig.
  if (night <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const ox = x + (30 + i * 30) * u;
    const oy = base - 80 * u;
    const angle = Math.sin(t * (0.6 + i * 0.17) + i * 1.3) * 0.6;
    const len = 150 * u;
    const spread = 18 * u;
    const tx = ox + Math.sin(angle) * len;
    const ty = oy - Math.cos(angle) * len;
    const beam = ctx.createLinearGradient(ox, oy, tx, ty);
    beam.addColorStop(0, `rgba(199,243,122,${0.28 * night})`);
    beam.addColorStop(1, 'rgba(199,243,122,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(tx - Math.cos(angle) * spread, ty - Math.sin(angle) * spread);
    ctx.lineTo(tx + Math.cos(angle) * spread, ty + Math.sin(angle) * spread);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawSkyline(ctx: CanvasRenderingContext2D, L: Layout, night: number, scroll: number, t: number): void {
  const u = L.scale * 0.85;
  const body = phase(SKYLINE, night);
  const detail = phase(SKYLINE_DETAIL, night);
  const base = L.groundY;
  const tileW = SKYLINE_TILE * u;
  const offset = ((scroll * L.scale * 0.2) % tileW + tileW) % tileW;

  for (let x0 = -offset; x0 < L.w; x0 += tileW) {
    tent(ctx, x0 + 10 * u, base, u, 60, 20, detail, body);
    tent(ctx, x0 + 90 * u, base, u, 48, 16, detail, body);
    stage(ctx, x0 + 190 * u, base, u, body, detail, night, t);
    ctx.fillStyle = body;
    ctx.fillRect(x0 + 370 * u, base - 56 * u, 2 * u, 56 * u); // light pole
    ctx.fillStyle = night > 0.5 ? BRAND.lime2 : detail;
    ctx.fillRect(x0 + 366 * u, base - 60 * u, 10 * u, 4 * u);
    tent(ctx, x0 + 400 * u, base, u, 60, 20, detail, body);
    tent(ctx, x0 + 480 * u, base, u, 60, 18, detail, body);
    tent(ctx, x0 + 560 * u, base, u, 48, 22, detail, body);
  }
}

// ── The field and the ground line ──

const TUFTS = (() => {
  const rng = { rng: 0x9a55 };
  return Array.from({ length: 40 }, () => ({
    x: nextRandom(rng) * 400,
    row: Math.floor(nextRandom(rng) * 6),
    w: 1 + Math.floor(nextRandom(rng) * 3),
  }));
})();

export function drawField(ctx: CanvasRenderingContext2D, L: Layout, night: number, scroll: number): void {
  const g = ctx.createLinearGradient(0, L.groundY, 0, L.h);
  g.addColorStop(0, phase({ day: FIELD.day.top, night: FIELD.night.top }, night));
  g.addColorStop(1, phase({ day: FIELD.day.bottom, night: FIELD.night.bottom }, night));
  ctx.fillStyle = g;
  ctx.fillRect(0, L.groundY, L.w, L.h - L.groundY);

  const p = L.pixel;
  ctx.fillStyle = phase(GROUND_LINE, night);
  ctx.fillRect(0, L.groundY, L.w, p);

  // Grass specks scroll with the track, so the ground reads as moving.
  const tile = 400 * L.scale;
  const off = ((scroll * L.scale) % tile + tile) % tile;
  ctx.fillStyle = phase({ day: '#2E8452', night: '#146B4C' }, night);
  for (let x0 = -off; x0 < L.w; x0 += tile) {
    for (const tuft of TUFTS) {
      const x = Math.round(x0 + tuft.x * L.scale);
      const y = L.groundY + p * (2 + tuft.row * 2);
      ctx.fillRect(x, y, p * tuft.w, p);
    }
  }
}

// ── 파도타기: the crowd in the field does the stadium wave ──

/**
 * Rows of students in ESKARA bandanas, nearer rows larger and faster. A wave
 * travels through them: a head rises, the arms go up, and at night each raised
 * hand holds a phone light — the poster's countless lights, held by the crowd.
 */
export function drawCrowd(ctx: CanvasRenderingContext2D, L: Layout, night: number, scroll: number, t: number): void {
  const fieldH = L.h - L.groundY;
  for (let row = 0; row < CROWD.length; row++) {
    const body = phase(CROWD[row]!, night);
    const p = L.pixel * (1 + row * 0.5);
    const spacing = p * 6;
    // Below the controls hint, down behind the shell's bottom bar.
    const baseY = L.groundY + fieldH * (0.52 + row * 0.17);
    const drift = (scroll * L.scale * (0.35 + row * 0.2)) % spacing;
    for (let x = -drift - spacing; x < L.w + spacing; x += spacing) {
      // Stagger alternate rows so heads sit between the ones in front.
      const cx = Math.round(x + (row % 2) * spacing * 0.5);
      const wave = Math.sin((cx / L.w) * Math.PI * 2 - t * 2.4 + row * 0.6);
      const lift = Math.max(0, wave) ** 3;
      const up = Math.round(lift * p * 3);
      const top = Math.round(baseY - up);

      ctx.fillStyle = body;
      ctx.fillRect(cx - p * 3, top + p * 3, p * 6, fieldH); // shoulders touch: one mass
      ctx.fillRect(cx - p, top, p * 3, p * 3); // head
      ctx.fillStyle = BRAND.lime;
      ctx.fillRect(cx - p, top, p * 3, p); // bandana

      if (lift > 0.35) {
        ctx.fillStyle = body;
        ctx.fillRect(cx - p * 2, top - p * 2, p, p * 5); // arms up
        ctx.fillRect(cx + p * 2, top - p * 2, p, p * 5);
        if (night > 0.3) {
          ctx.globalAlpha = night;
          ctx.fillStyle = BRAND.lime2;
          ctx.fillRect(cx - p * 2, top - p * 3, p, p);
          ctx.fillRect(cx + p * 2, top - p * 3, p, p);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}
