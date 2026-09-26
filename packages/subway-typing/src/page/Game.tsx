import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { TOTAL_KEYS } from '../bound';
import { LINES, ROUTE, STOP_COUNT } from '../data/route';
import { BACKGROUND, CHROME_HEIGHT, TITLE_HEIGHT } from '../layout';
import { gameReducer, initialGame, totalMs } from '../lib/game';
import { isStaleCommit, isTypo, judge, type Judgement } from '../lib/judge';
import { accuracy, formatTime, keyCount, keysPerMinute } from '../lib/stats';
import { PRIMARY, SdsColors } from './colors';
import { onHost, post } from './host';
import { RouteStrip } from './RouteStrip';
import { StationPrompt } from './StationPrompt';
import { useVisualViewport } from './useVisualViewport';

const LAST = ROUTE.length - 1;
const TRANSFER_AT = ROUTE.findIndex((s) => s.transferTo);
const reduce = gameReducer(STOP_COUNT);

/** Keys typed by the time `n` stations have been reached. */
const KEYS_BY = Array.from({ length: STOP_COUNT + 1 }, (_, n) => keyCount(ROUTE.slice(0, n).map((s) => s.name)));

const nameAt = (i: number) => ROUTE[i]?.name ?? '';

/** Room at the top for the host's floating buttons, and on the title for its title block. */
const topPad = (extra: number) => `calc(var(--inset-top, 0px) + ${extra}px)`;

/**
 * The game page. It plays; the app hosts it — the title, the best, the result
 * card and the Hall of Fame are drawn natively over this page, and it talks to
 * them through `@skkuverse/game-host` (./host.ts).
 *
 * Unlike the web version, the page has no result screen of its own: arriving
 * at 성균관대 reports the run and shows a short arrival card underneath the
 * app's result panel, and "next" there sends `host:reset` back to the title.
 */
export default function Game() {
  const box = useVisualViewport();
  const [state, dispatch] = useReducer(reduce, initialGame);
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(0);

  const input = useRef<HTMLInputElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const kpmEl = useRef<HTMLSpanElement>(null);
  const prev = useRef<Judgement>(judge('', nameAt(0)));
  const justArrived = useRef(false);

  const target = ROUTE[state.at];
  const judgement = useMemo(() => judge(value, target?.name ?? ''), [value, target]);
  // Where the train is: the last station reached, plus the share of the next
  // name typed correctly so far.
  const progress = state.at - 1 + (target ? judgement.goodKeys / (KEYS_BY[state.at + 1]! - KEYS_BY[state.at]!) : 0);

  // The host speaks after `game:ready`. A typing run keeps its clock through a
  // pause (the host's `host:pause` is ignored), and the best is the host's to
  // draw, so only going back to the title needs anything from the page.
  useEffect(() => {
    const off = onHost((m) => {
      // A restart the player did not tap on the page could not raise the
      // keyboard, so it goes back to the title like a reset.
      if (m.type !== 'host:reset' && m.type !== 'host:restart') return;
      input.current?.blur();
      dispatch({ type: 'reset' });
      setValue('');
      post({ type: 'game:phase', phase: 'ready' });
    });
    post({ type: 'game:ready' });
    return off;
  }, []);

  // The clock and the live speed repaint every frame. They write straight to
  // the DOM so the frame loop never re-renders the page.
  const live = useRef({ startedAt: state.startedAt, at: state.at, goodKeys: 0 });
  live.current = { startedAt: state.startedAt, at: state.at, goodKeys: judgement.goodKeys };
  useEffect(() => {
    if (state.phase !== 'playing') return;
    let frame = 0;
    const paint = () => {
      const { startedAt, at, goodKeys } = live.current;
      const ms = startedAt === null ? 0 : performance.now() - startedAt;
      if (timeEl.current) timeEl.current.textContent = formatTime(ms);
      if (kpmEl.current) kpmEl.current.textContent = `${keysPerMinute(KEYS_BY[at]! + goodKeys, ms)}타`;
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [state.phase]);

  // Arrived: the run is reported. The score is the time, whole milliseconds.
  // (The keyboard went down with the input, in `onChange`.)
  useEffect(() => {
    if (state.phase !== 'finished') return;
    const ms = Math.round(totalMs(state));
    post({ type: 'game:haptic', style: 'medium' });
    post({
      type: 'game:over',
      score: ms,
      ticks: TOTAL_KEYS,
      hit: null,
      revives: 0,
      revivesLeft: 0,
      stats: {
        kpm: keysPerMinute(TOTAL_KEYS, ms),
        accuracy: accuracy(TOTAL_KEYS, state.typos),
        typos: state.typos,
      },
    });
    // Runs once per finish; `state` is complete by the time phase flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const start = () => {
    // Commit synchronously so the input exists before focus() is called: iOS
    // raises the keyboard only for a focus made inside the tap itself. The
    // restart button calls this mid-run too; the input stays mounted then, so
    // the keyboard never drops.
    flushSync(() => {
      dispatch({ type: 'start' });
      setValue('');
    });
    prev.current = judge('', nameAt(0));
    justArrived.current = false;
    input.current?.focus();
    post({ type: 'game:start' });
    post({ type: 'game:phase', phase: 'running' });
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!target) return;
    const now = performance.now();
    const next = event.target.value;

    if (justArrived.current) {
      justArrived.current = false;
      if (isStaleCommit(next, nameAt(state.at - 1), target.name)) {
        setValue('');
        return;
      }
    }

    if (next) dispatch({ type: 'key', now });
    const j = judge(next, target.name);
    if (isTypo(prev.current, j)) dispatch({ type: 'typo' });
    if (j.status === 'wrong' && prev.current.status !== 'wrong') setShake((n) => n + 1);

    if (j.status === 'done') {
      // The last station: the keyboard goes down so the host's result panel
      // is not under it. Blurred here, while the input still exists.
      if (state.at + 1 >= STOP_COUNT) input.current?.blur();
      dispatch({ type: 'arrive', now });
      setValue('');
      justArrived.current = true;
      prev.current = judge('', nameAt(state.at + 1));
      if (state.at + 1 < STOP_COUNT) post({ type: 'game:haptic', style: 'light' });
      return;
    }
    prev.current = j;
    setValue(next);
  };

  const lineColor = LINES[target?.line ?? '1'].color;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: box.top,
        height: box.height,
        boxSizing: 'border-box',
        paddingTop: topPad(state.phase === 'ready' ? CHROME_HEIGHT + TITLE_HEIGHT : CHROME_HEIGHT),
        // The home indicator's clearance — but not while a soft keyboard is
        // up: then the keyboard borders the page, and the inset would only
        // push the input away from it.
        paddingBottom: box.keyboardOpen ? 0 : 'var(--inset-bottom, 0px)',
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: BACKGROUND,
        color: SdsColors.grey900,
      }}
    >
      {state.phase === 'ready' && <Ready onStart={start} />}

      {state.phase === 'finished' && <Arrived ms={totalMs(state)} />}

      {/* Mounted through the whole run so the input keeps its focus. */}
      {state.phase === 'playing' && target && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px', gap: 12 }}>
            <span
              ref={timeEl}
              style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
            >
              {formatTime(0)}
            </span>
            <span style={{ flex: 1 }} />
            <span ref={kpmEl} style={{ fontSize: 14, color: SdsColors.grey600, fontVariantNumeric: 'tabular-nums' }}>
              0타
            </span>
            <button
              type="button"
              // Keep the tap from taking focus off the input, or the keyboard
              // would drop and rise again on every restart.
              onPointerDown={(e) => e.preventDefault()}
              onClick={start}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: 0,
                background: SdsColors.grey100,
                color: SdsColors.grey700,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              <RestartIcon />
              다시 시작
            </button>
          </div>

          <RouteStrip progress={progress} />

          <div
            onClick={() => input.current?.focus()}
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 20px',
            }}
          >
            {state.at - 1 === TRANSFER_AT && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: LINES['1'].color,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  animation: 'subway-banner 2200ms ease-out forwards',
                }}
              >
                금정역 · 1호선으로 환승
              </div>
            )}
            <StationPrompt station={target} after={ROUTE[state.at + 1]} marks={judgement.marks} shake={shake} />
          </div>

          <div style={{ padding: '8px 16px 12px' }}>
            <input
              ref={input}
              value={value}
              onChange={onChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              lang="ko"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-label={`${target.name} 입력`}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                // 16px or more, or iOS zooms the page on focus.
                fontSize: 22,
                fontWeight: 700,
                fontFamily: 'inherit',
                borderRadius: 14,
                border: `2px solid ${judgement.status === 'wrong' ? SdsColors.red500 : lineColor}`,
                outline: 'none',
                background: judgement.status === 'wrong' ? SdsColors.red50 : '#fff',
                color: SdsColors.grey900,
                transition: 'border-color 120ms, background 120ms',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function BottomButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px 16px' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          minHeight: 56,
          border: 0,
          borderRadius: 16,
          background: PRIMARY,
          color: '#fff',
          fontSize: 17,
          fontWeight: 700,
          fontFamily: 'inherit',
        }}
      >
        {children}
      </button>
    </div>
  );
}

/** The title screen under the host's title block: the route, and the button that starts it. */
function Ready({ onStart }: { onStart: () => void }) {
  const legs = [
    { line: '4' as const, text: `${nameAt(0)} → ${nameAt(TRANSFER_AT)}` },
    { line: '1' as const, text: `${nameAt(TRANSFER_AT)} → ${nameAt(LAST)}` },
  ];
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <RouteStrip progress={-1} />

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {legs.map((leg) => (
            <div key={leg.line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LineBadge line={leg.line} />
              <span style={{ flex: 1, fontSize: 15, color: SdsColors.grey700 }}>{leg.text}</span>
            </div>
          ))}
        </div>
      </div>
      <BottomButton onClick={onStart}>출발하기</BottomButton>
    </>
  );
}

/** Under the host's result panel for a moment: the train in at 성균관대, and the time. */
function Arrived({ ms }: { ms: number }) {
  return (
    <>
      <RouteStrip progress={LAST} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          animation: 'subway-arrive 260ms ease-out',
        }}
      >
        <LineBadge line="1" />
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>성균관대 도착</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: SdsColors.grey600, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(ms)}
        </div>
      </div>
    </>
  );
}

function LineBadge({ line }: { line: '4' | '1' }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: LINES[line].color,
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {LINES[line].name}
    </span>
  );
}

function RestartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
