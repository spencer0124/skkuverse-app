import { LINES, type Station } from '../data/route';
import type { Mark } from '../lib/judge';
import { SdsColors } from './colors';

interface Props {
  station: Station;
  after: Station | undefined;
  marks: Mark[];
  /** Bumped on every slip; re-keys the name so the shake replays. */
  shake: number;
}

/** The station to type next, large, coloured character by character as it is typed. */
export function StationPrompt({ station, after, marks, shake }: Props) {
  const line = LINES[station.line];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 999,
            background: line.color,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {line.name}
        </span>
        <span style={{ fontSize: 15, fontWeight: 500, color: SdsColors.grey600 }}>이번 역은</span>
      </div>

      {/* Keyed on the station too, so each new name slides in. */}
      <div key={station.name} style={{ animation: 'subway-next 220ms ease-out' }}>
        <div
          key={shake}
          style={{
            fontSize: [...station.name].length > 6 ? 34 : 44,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            textAlign: 'center',
            wordBreak: 'keep-all',
            animation: shake > 0 ? 'subway-shake 300ms ease-out' : undefined,
          }}
        >
          {[...station.name].map((ch, i) => (
            <span
              key={i}
              style={{
                color: marks[i] === 'hit' ? line.color : marks[i] === 'miss' ? SdsColors.red500 : SdsColors.grey900,
                background: marks[i] === 'miss' ? SdsColors.red50 : undefined,
                borderRadius: 6,
                transition: 'color 80ms',
              }}
            >
              {ch}
            </span>
          ))}
          {station.sub && (
            <span style={{ fontSize: 20, fontWeight: 500, color: SdsColors.grey500, marginLeft: 6 }}>
              ({station.sub})
            </span>
          )}
        </div>
      </div>

      <span style={{ fontSize: 14, color: SdsColors.grey500, minHeight: 20 }}>
        {after ? `다음 역 · ${after.name}` : '종착 · 성균관대에서 내리세요'}
      </span>
    </div>
  );
}
