/**
 * Locate-button glyph for the heading (`Face`) tracking state.
 *
 * A heading beam laid OVER the idle state's crosshair, not stacked above it.
 * Its apex sits on the crosshair's own centre, so the two read as one mark
 * rather than two glyphs sharing a box. The button means the same thing in both
 * states ("centre on me"); the beam only adds "and the map now follows which way
 * you point". That is also why the crosshair is the same `CrosshairSimple` the
 * idle state draws — swapping the glyph as well would make the two states look
 * like two different buttons.
 *
 * The beam's mouth is inset from the button's edge and closed with an arc,
 * rather than run to the edge and clipped by the circle. Clipping there pinches
 * the mouth to nothing: the button's own circle passes through the top-centre of
 * the icon box, so its half-width at that height is zero. An inset arc is what
 * leaves the ring of white the design keeps above the beam.
 *
 * The beam never rotates. In `Face` mode the SDK turns the whole map so the
 * user's heading points up — "up" already IS the heading, and rotating the beam
 * would apply it twice.
 */

import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { CrosshairSimpleIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';

/** The whole button, so the beam is positioned against the circle it sits in. */
const BOX = 40;
const CENTRE = BOX / 2;
/** Matches the idle state's crosshair — the glyph must not resize between states. */
const GLYPH = 20;

const MOUTH_Y = 7;
const MOUTH_HALF_WIDTH = 9;
/** Larger than the mouth's half-width, so the arc is a gentle bow, not a dome. */
const MOUTH_ARC_R = 20;
const BEAM = [
  `M ${CENTRE} ${CENTRE}`,
  `L ${CENTRE - MOUTH_HALF_WIDTH} ${MOUTH_Y}`,
  `A ${MOUTH_ARC_R} ${MOUTH_ARC_R} 0 0 1 ${CENTRE + MOUTH_HALF_WIDTH} ${MOUTH_Y}`,
  'Z',
].join(' ');

export function HeadingLocateIcon() {
  return (
    <View style={styles.root}>
      <CrosshairSimpleIcon size={GLYPH} color={SdsColors.brand} weight="bold" />
      <Svg
        width={BOX}
        height={BOX}
        viewBox={`0 0 ${BOX} ${BOX}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {/* Faint at the mouth, solid at the apex — the beam reads as light
              cast FROM the crosshair, which is what ties it to the mark instead
              of leaving it a shape parked on top. */}
          <LinearGradient id="headingBeam" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SdsColors.brand} stopOpacity={0.15} />
            <Stop offset="1" stopColor={SdsColors.brand} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path d={BEAM} fill="url(#headingBeam)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
