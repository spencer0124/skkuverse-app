/**
 * Abstract mini-map thumbnail, drawn in SVG.
 *
 * One geometry, three palettes. The reference sheet this copies shows the same
 * river, park and road network in every tile and only restyles it — which is
 * also why this is drawn rather than shipped as art: three bitmaps per theme,
 * at three densities, to say "the map looks different" is a lot of bytes for a
 * 64pt square, and a drawn one recolours for free.
 *
 * The shapes are deliberately not SKKU's campus. A thumbnail is a legend for a
 * style, not a preview of a place, and a recognisable-but-wrong campus reads as
 * a bug in a way an obvious abstraction does not.
 */

import Svg, { Path, Rect } from 'react-native-svg';

export type MapThumbPalette = 'basic' | 'satellite' | 'terrain';

interface Palette {
  land: string;
  park: string;
  water: string;
  roadMajor: string;
  roadMinor: string;
  block: string;
}

const PALETTES: Record<MapThumbPalette, Palette> = {
  basic: {
    land: '#F1F3F0',
    park: '#D9EAD3',
    water: '#BFDCF5',
    roadMajor: '#FFD9A0',
    roadMinor: '#FFFFFF',
    block: '#E3E7E3',
  },
  satellite: {
    land: '#4A5540',
    park: '#38632F',
    water: '#2E4A66',
    roadMajor: '#C9A96A',
    roadMinor: '#8E9A85',
    block: '#58604E',
  },
  terrain: {
    land: '#EFEDE4',
    park: '#CFE3C2',
    water: '#BFDCF5',
    roadMajor: '#E8C89A',
    roadMinor: '#FFFFFF',
    block: '#DEDBCD',
  },
};

export function MapThumb({ palette }: { palette: MapThumbPalette }) {
  const c = PALETTES[palette];
  return (
    // No width/height: the SVG fills whatever square the tile gives it, so the
    // caller owns sizing and this stays a pure style.
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Rect x={0} y={0} width={100} height={100} fill={c.land} />

      {/* Park, upper left */}
      <Path d="M-6,-6 C22,-8 40,10 34,28 C28,44 6,48 -6,38 Z" fill={c.park} />

      {/* City blocks, upper right and lower right */}
      <Rect x={58} y={10} width={16} height={13} rx={2} fill={c.block} />
      <Rect x={79} y={10} width={18} height={13} rx={2} fill={c.block} />
      <Rect x={58} y={82} width={20} height={16} rx={2} fill={c.block} />

      {/* River — the shape that makes the three palettes read as one place */}
      <Path
        d="M-4,54 C18,46 34,64 54,57 C72,51 86,61 104,54 L104,72 C86,79 72,69 54,75 C34,82 18,64 -4,72 Z"
        fill={c.water}
      />

      {/* Roads: one major arterial, two minor. Stroked, not filled, so the
          palette's contrast does the work at 64pt where fills would mud. */}
      <Path d="M-4,32 C28,27 62,36 104,29" stroke={c.roadMajor} strokeWidth={7} fill="none" />
      <Path d="M26,-4 L33,52" stroke={c.roadMinor} strokeWidth={4} fill="none" />
      <Path d="M-4,88 C26,84 62,92 104,86" stroke={c.roadMinor} strokeWidth={4} fill="none" />
    </Svg>
  );
}
