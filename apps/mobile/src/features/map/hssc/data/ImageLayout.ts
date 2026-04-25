/**
 * Layout data for background images extracted from SVG patterns.
 *
 * Each pattern references one of 4 unique base64 images (image0~3).
 * Positions and sizes come from the SVG <rect fill="url(#patternN)"> elements.
 * Images are placed at these exact SVG-space coordinates inside ZoomableContainer.
 *
 * Pattern → Image mapping:
 *   pattern0,1,2 → image0 (campus map background, different crops via matrix transform)
 *   pattern3     → image1 (placeinfo/legend box)
 *   pattern4     → image2 (운동장/playground)
 *   pattern5,6,7 → image3 (bus icon, same image reused)
 */

export interface ImageLayoutEntry {
  /** Require-able image asset */
  source: number; // ReturnType<typeof require>
  /** Position and size in SVG coordinate space */
  x: number;
  y: number;
  width: number;
  height: number;
}

 
const image0 = require('../assets/hssc_image0.png');
 
const image1 = require('../assets/hssc_image1.png');
 
const image2 = require('../assets/hssc_image2.png');
 
const image3 = require('../assets/hssc_image3.png');

export const IMAGE_LAYOUT: ImageLayoutEntry[] = [
  // pattern0: left strip (crop of image0)
  { source: image0, x: 70, y: 268, width: 162, height: 3276 },
  // pattern1: center-left buildings (crop of image0)
  { source: image0, x: 232, y: 269, width: 1581, height: 3451 },
  // pattern2: right buildings (crop of image0)
  { source: image0, x: 1813, y: 268, width: 2444, height: 3451 },
  // pattern3: placeinfo/legend box
  { source: image1, x: 3280, y: 110, width: 868, height: 763 },
  // pattern4: 운동장/playground
  { source: image2, x: 970, y: 2624, width: 693, height: 604 },
  // pattern5: bus 07 icon
  { source: image3, x: 1366, y: 2509, width: 81, height: 81 },
  // pattern6: bus hssc icon
  { source: image3, x: 1513, y: 2509, width: 81, height: 81 },
  // pattern7: bus 02 icon
  { source: image3, x: 329, y: 717, width: 81, height: 81 },
];

/** SVG viewBox dimensions */
export const SVG_WIDTH = 4257;
export const SVG_HEIGHT = 3720;
