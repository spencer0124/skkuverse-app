import { ELEMENT_COORDS, type ElementCoord } from '../data/ElementCoordinates';

/**
 * Find the interactive element at the given SVG-space coordinates.
 * Returns the element ID (without _clickarea suffix) or null if no hit.
 */
export function findElementAtPoint(
  svgX: number,
  svgY: number,
): string | null {
  for (const [id, coord] of Object.entries(ELEMENT_COORDS)) {
    if (isInsideElement(svgX, svgY, coord)) {
      return id;
    }
  }
  return null;
}

function isInsideElement(
  x: number,
  y: number,
  coord: ElementCoord,
): boolean {
  if (coord.type === 'ellipse') {
    // Ellipse hit test: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1
    const dx = (x - coord.cx) / coord.rx;
    const dy = (y - coord.cy) / coord.ry;
    return dx * dx + dy * dy <= 1;
  }
  // Rect hit test: |x-cx| <= rx && |y-cy| <= ry
  return (
    Math.abs(x - coord.cx) <= coord.rx &&
    Math.abs(y - coord.cy) <= coord.ry
  );
}
