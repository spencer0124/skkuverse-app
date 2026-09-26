import type { Sprite } from '../sprites';
import type { Palette } from './palette';

/**
 * Paint a sprite once, one canvas pixel per art pixel. Drawing it scaled up with
 * smoothing off is then a single drawImage per frame instead of a fillRect per
 * pixel.
 */
export function bake(sprite: Sprite, palette: Palette): HTMLCanvasElement {
  const rows = sprite.rows;
  const canvas = document.createElement('canvas');
  canvas.width = rows[0]!.length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]!];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}
