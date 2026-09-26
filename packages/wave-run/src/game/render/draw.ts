import { PLAYER_X, VIEW_HEIGHT, VIEW_WIDTH } from '../constants';
import type { WorldBox } from '../collision';
import type { GameState } from '../engine';
import { animFrame, obstacleBoxes, spriteOf, type Obstacle } from '../obstacles';
import { playerBoxes } from '../player';
import { formatScore } from '../score';
import {
  BIG_WAVE,
  type WaveArt,
  BUS,
  PLAYER_CRASH,
  PLAYER_DUCK,
  PLAYER_IDLE,
  PLAYER_JUMP,
  PLAYER_RUN,
  RIPPLE,
  type Sprite,
} from '../sprites';
import { drawCrowd, drawField, drawLightWaves, drawSky, drawSkyline, makeDots, type Dot } from './background';
import { bake } from './bake';
import { drawLandmarks } from './skyline';
import { WaterFx } from './water';
import { computeLayout, snap, type Layout } from './layout';
import { BRAND, BUS_PALETTE, HUD_TEXT, PLAYER_PALETTE, WAVE_PALETTE, phase } from './palette';

// 3×5 pixel digits, drawn cell by cell like the original's score.
const GLYPHS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
  H: '101101111101101',
  I: '111010010010111',
  ' ': '000000000000000',
};

export interface Overlay {
  hi: number;
  /** performance.now() until which the score blinks after a milestone. */
  flashUntil: number;
  /** performance.now() of the crash, for the splash. */
  crashedAt: number | null;
  /** The last mid-air jump: when, and the height it kicked off from. */
  doubleJump: { at: number; y: number } | null;
  debug: boolean;
}

interface Baked {
  run: HTMLCanvasElement[];
  duck: HTMLCanvasElement[];
  idle: HTMLCanvasElement;
  jump: HTMLCanvasElement;
  crash: HTMLCanvasElement;
  /** [group size - 1][frame] */
  ripple: HTMLCanvasElement[][];
  wave: HTMLCanvasElement[][];
  bus: HTMLCanvasElement[];
}

const bakeWaves = (art: WaveArt) => art.sprites.map((frames) => frames.map((f) => bake(f, WAVE_PALETTE)));

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private layout: Layout = computeLayout(1, 1, 1);
  private readonly baked: Baked;
  private readonly dots: Dot[] = makeDots(160);
  private readonly water = new WaterFx();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.baked = {
      run: PLAYER_RUN.map((s) => bake(s, PLAYER_PALETTE)),
      duck: PLAYER_DUCK.map((s) => bake(s, PLAYER_PALETTE)),
      idle: bake(PLAYER_IDLE, PLAYER_PALETTE),
      jump: bake(PLAYER_JUMP, PLAYER_PALETTE),
      crash: bake(PLAYER_CRASH, PLAYER_PALETTE),
      ripple: bakeWaves(RIPPLE),
      wave: bakeWaves(BIG_WAVE),
      bus: BUS.map((b) => bake(b, BUS_PALETTE)),
    };
  }

  resize(w: number, h: number, dpr: number): void {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layout = computeLayout(w, h, dpr);
  }

  /** A new run: clear the water left over from the last one. */
  reset(): void {
    this.water.reset();
  }

  getLayout(): Layout {
    return this.layout;
  }

  /** `alpha` is how far the display is between the last two ticks, 0–1. */
  render(s: GameState, alpha: number, now: number, overlay: Overlay): void {
    const { ctx } = this;
    const L = this.layout;
    const t = now / 1000;
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const scroll = s.prevDistance + (s.distance - s.prevDistance) * alpha;
    drawSky(ctx, L, s.night);
    drawLightWaves(ctx, L, this.dots, s.night, t, scroll);
    drawLandmarks(ctx, L, s.night, scroll);
    drawSkyline(ctx, L, s.night, scroll, t);
    drawField(ctx, L, s.night, scroll);
    drawCrowd(ctx, L, s.night, scroll, t);

    this.water.update(s, now);

    // Obstacles spawn at the world's right edge; when the screen is wider than
    // the world, clip so they slide in instead of popping into view.
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.worldLeft, 0, VIEW_WIDTH * L.scale, L.h);
    ctx.clip();
    this.water.drawWakes(ctx, L, s, alpha, t);
    for (const o of s.obstacles) this.drawObstacle(o, s, alpha);
    this.water.drawDrops(ctx, L, s.night);
    ctx.restore();

    this.drawPlayer(s, alpha, t);
    if (overlay.doubleJump) this.drawKick(overlay.doubleJump.y, now - overlay.doubleJump.at);
    if (overlay.crashedAt !== null) this.drawSplash(s, now - overlay.crashedAt);
    this.drawHud(s, now, overlay);
    if (overlay.debug) this.drawDebug(s);
  }

  private toScreen(worldX: number, bottom: number, sprite: Sprite): { x: number; y: number; w: number; h: number } {
    const L = this.layout;
    const w = sprite.w * L.scale;
    const h = sprite.h * L.scale;
    return {
      x: snap(L.worldLeft + worldX * L.scale, L.dpr),
      y: snap(L.groundY - bottom * L.scale - h, L.dpr),
      w,
      h,
    };
  }

  private blit(img: HTMLCanvasElement, worldX: number, bottom: number, sprite: Sprite): void {
    const r = this.toScreen(worldX, bottom, sprite);
    this.ctx.drawImage(img, r.x, r.y, r.w, r.h);
  }

  private drawObstacle(o: Obstacle, s: GameState, alpha: number): void {
    const x = o.prevX + (o.x - o.prevX) * alpha;
    const { ctx } = this;
    if (o.kind === 'bus') {
      const f = animFrame(o, s.tick);
      // It lifts a pixel on each downstroke, the way the pterodactyl bobs.
      const y = o.alt + (f === 1 ? 2 : 0);
      if (s.night > 0) this.drawHeadlight(x, y, s.night);
      this.blit(this.baked.bus[f]!, x, y, BUS[f]!);
      return;
    }
    // At night the water catches the stage lights.
    if (s.night > 0) {
      ctx.shadowColor = `rgba(155,234,101,${0.8 * s.night})`;
      ctx.shadowBlur = 10 * this.layout.scale;
    }
    const f = animFrame(o, s.tick);
    this.blit(this.baked[o.kind][o.size - 1]![f]!, x, 0, spriteOf(o.kind, o.size, f));
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  /** At night its headlight, facing the runner, throws a short beam ahead. */
  private drawHeadlight(x: number, alt: number, night: number): void {
    const L = this.layout;
    const { ctx } = this;
    const hx = L.worldLeft + (x + 3) * L.scale;
    const hy = L.groundY - (alt + BUS[0]!.h - 19) * L.scale;
    const len = 60 * L.scale;
    const g = ctx.createLinearGradient(hx, hy, hx - len, hy);
    g.addColorStop(0, `rgba(255,246,194,${0.5 * night})`);
    g.addColorStop(1, 'rgba(255,246,194,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 2 * L.scale);
    ctx.lineTo(hx - len, hy - 10 * L.scale);
    ctx.lineTo(hx - len, hy + 10 * L.scale);
    ctx.lineTo(hx, hy + 2 * L.scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(s: GameState, alpha: number, t: number): void {
    const p = s.player;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    const b = this.baked;
    if (s.status === 'crashed') return this.blit(b.crash, PLAYER_X, y, PLAYER_CRASH);
    if (s.status === 'ready') {
      // A small hop in place while waiting, so the title screen is alive.
      return this.blit(b.idle, PLAYER_X, Math.max(0, Math.sin(t * 4)) * 2, PLAYER_IDLE);
    }
    if (p.jumping) return this.blit(b.jump, PLAYER_X, y, PLAYER_JUMP);
    const frame = Math.floor(s.tick / 5) % 2;
    if (p.ducking) return this.blit(b.duck[frame]!, PLAYER_X, 0, PLAYER_DUCK[frame]!);
    this.blit(b.run[frame]!, PLAYER_X, 0, PLAYER_RUN[frame]!);
  }

  /** A ring of spray where the mid-air jump pushed off, drifting back with the track. */
  private drawKick(y: number, ms: number): void {
    const life = 320;
    if (ms > life) return;
    const L = this.layout;
    const { ctx } = this;
    const k = ms / life;
    const cx = L.worldLeft + (PLAYER_X + 18 - k * 30) * L.scale;
    const cy = L.groundY - y * L.scale;
    const r = (6 + k * 16) * L.scale;
    const p = L.pixel;
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillStyle = i % 2 === 0 ? BRAND.mint : BRAND.lime;
      // Flattened, like a splash seen from the side.
      ctx.fillRect(Math.round(cx + Math.cos(a) * r - p / 2), Math.round(cy + Math.sin(a) * r * 0.45 - p / 2), p, p);
    }
    ctx.globalAlpha = 1;
  }

  /** Droplets burst from the runner; positions are a function of time, no state. */
  private drawSplash(s: GameState, ms: number): void {
    if (ms > 900) return;
    const L = this.layout;
    const { ctx } = this;
    const sec = ms / 1000;
    const ox = L.worldLeft + (PLAYER_X + 24) * L.scale;
    const oy = L.groundY - (s.player.y + 20) * L.scale;
    const p = L.pixel;
    ctx.globalAlpha = Math.max(0, 1 - ms / 900);
    for (let i = 0; i < 14; i++) {
      const angle = -Math.PI / 2 + ((i / 13) * 2 - 1) * 1.2;
      const speed = (90 + ((i * 37) % 60)) * L.scale;
      const x = ox + Math.cos(angle) * speed * sec;
      const y = oy + Math.sin(angle) * speed * sec + 400 * L.scale * sec * sec;
      ctx.fillStyle = i % 3 === 0 ? BRAND.mint : i % 3 === 1 ? BRAND.lime : BRAND.green;
      ctx.fillRect(Math.round(x), Math.round(y), p * (i % 4 === 0 ? 2 : 1), p * (i % 4 === 0 ? 2 : 1));
    }
    ctx.globalAlpha = 1;
  }

  private drawText(text: string, right: number, top: number, cell: number): void {
    const { ctx } = this;
    const advance = cell * 4;
    let x = right - text.length * advance + cell;
    for (const ch of text) {
      const glyph = GLYPHS[ch] ?? GLYPHS[' ']!;
      for (let i = 0; i < 15; i++) {
        if (glyph[i] === '1') ctx.fillRect(x + (i % 3) * cell, top + Math.floor(i / 3) * cell, cell, cell);
      }
      x += advance;
    }
  }

  private drawHud(s: GameState, now: number, overlay: Overlay): void {
    const L = this.layout;
    const cell = Math.max(2, Math.round(3 * L.scale));
    const right = L.worldLeft + VIEW_WIDTH * L.scale - 12 * L.scale;
    const top = Math.round(L.groundY - VIEW_HEIGHT * L.scale);
    this.ctx.fillStyle = phase(HUD_TEXT, s.night);

    const blinking = now < overlay.flashUntil && Math.floor((overlay.flashUntil - now) / 150) % 2 === 0;
    if (!blinking) this.drawText(formatScore(s.score), right, top, cell);
    if (overlay.hi > 0) {
      this.ctx.globalAlpha = 0.7;
      this.drawText(`HI ${formatScore(overlay.hi)}`, right - cell * 4 * 6.5, top, cell);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawDebug(s: GameState): void {
    const { ctx } = this;
    const L = this.layout;
    const box = (b: WorldBox) =>
      ctx.strokeRect(
        L.worldLeft + b.left * L.scale,
        L.groundY - b.top * L.scale,
        (b.right - b.left) * L.scale,
        (b.top - b.bottom) * L.scale,
      );
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff2d55';
    playerBoxes(s.player).forEach(box);
    ctx.strokeStyle = '#2d7bff';
    for (const o of s.obstacles) obstacleBoxes(o).forEach(box);
    ctx.fillStyle = '#ff2d55';
    ctx.font = '11px monospace';
    ctx.fillText(`speed ${s.speed.toFixed(2)} tick ${s.tick} night ${s.night.toFixed(2)}`, 8, L.h - 80);
  }
}
