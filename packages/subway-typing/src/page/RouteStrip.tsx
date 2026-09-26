import { useEffect, useRef } from 'react';
import metro from '../assets/metro.png';
import { LINES, ROUTE } from '../data/route';
import { SdsColors } from './colors';

/** Width of one station's column. */
const W = 72;
const DOT = 14;
const TRACK_Y = 34;
const TRAIN = 22;

/** Centre of station `i`. Column 0 is the siding the train waits in before 혜화. */
const xOf = (i: number) => (i + 1) * W + W / 2;

/**
 * The line map across the top: every station on the route in one row, the
 * track in the colour of the line that serves it, and the train.
 *
 * `progress` is fractional: 3.4 is four tenths of the way from station 3 to
 * station 4, measured in keys typed of station 4's name. So the train creeps
 * along with every correct key and pulls in on the last one, and the track it
 * has covered fades behind it. -1 is the siding before 혜화.
 *
 * The train is Tossface's 🚇, as an image cut from the app's own copy of the
 * font (scripts/metro-glyph.py): the page may not load a web font, and the
 * system emoji would not match the rest of the app.
 */
export function RouteStrip({ progress }: { progress: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const trainX = xOf(progress);
  const reached = Math.floor(progress);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: trainX - el.clientWidth / 2, behavior: 'smooth' });
  }, [trainX]);

  return (
    <div ref={scroller} className="no-scrollbar" style={{ overflowX: 'auto', flexShrink: 0 }}>
      <div style={{ position: 'relative', width: (ROUTE.length + 1) * W, height: 88 }}>
        {ROUTE.map((station, i) => (
          <div
            key={`track-${station.name}`}
            style={{
              position: 'absolute',
              left: xOf(i - 1),
              top: TRACK_Y - 3,
              width: W,
              height: 6,
              background: LINES[station.line].color,
            }}
          />
        ))}

        {/* The covered track, washed out up to the train. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: TRACK_Y - 3,
            width: trainX,
            height: 6,
            background: 'rgba(255, 255, 255, 0.7)',
            transition: 'width 160ms ease-out',
          }}
        />

        {ROUTE.map((station, i) => {
          const passed = i < reached;
          const here = i === reached;
          const color = LINES[station.transferTo ?? station.line].color;
          return (
            <div
              key={station.name}
              style={{
                position: 'absolute',
                left: xOf(i) - W / 2,
                top: TRACK_Y - DOT / 2,
                width: W,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  width: DOT,
                  height: DOT,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  background: '#fff',
                  border: `3px solid ${passed ? SdsColors.grey300 : LINES[station.line].color}`,
                  // A transfer station gets the second line's ring around it.
                  boxShadow: station.transferTo ? `0 0 0 3px #fff, 0 0 0 5px ${color}` : undefined,
                  transition: 'border-color 200ms',
                }}
              />
              <span
                style={{
                  marginTop: 8,
                  padding: '0 4px',
                  fontSize: 11,
                  lineHeight: 1.25,
                  textAlign: 'center',
                  wordBreak: 'break-all',
                  fontWeight: here ? 700 : 500,
                  color: here ? SdsColors.grey900 : passed ? SdsColors.grey400 : SdsColors.grey600,
                }}
              >
                {station.name}
              </span>
            </div>
          );
        })}

        <img
          src={metro}
          alt=""
          aria-hidden
          width={TRAIN}
          height={TRAIN}
          style={{
            position: 'absolute',
            top: 0,
            left: trainX - TRAIN / 2,
            transition: 'left 160ms ease-out',
          }}
        />
      </div>
    </div>
  );
}
