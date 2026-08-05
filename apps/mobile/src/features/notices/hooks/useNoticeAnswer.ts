/**
 * Seam for the natural-language answer layer on the notices search screen.
 *
 * The vector / hybrid search backend does not exist yet, so the production
 * implementation returns `unavailable` unconditionally and `NoticeAnswerCard`
 * renders nothing. That is deliberate: shipping a placeholder "AI" surface that
 * can't answer anything is worse than shipping no surface. What this release
 * actually changes for users is the scope toggle, the idle state, and the
 * zero-result recovery — all of which work today.
 *
 * When the backend lands, only the body of this hook changes. The state union,
 * the card, and the screen wiring stay as they are.
 *
 * ── Design constraints the state union encodes ──
 *
 * `pending` is separate from `streaming` because the two need different
 * layouts: pending reserves height so the notice rows beneath don't jump once
 * tokens arrive, streaming grows inside that reservation.
 *
 * `abstained` is a first-class state rather than an empty `done`. When
 * retrieval turns up thin evidence the honest move is to say so and leave the
 * ranked list to do the work — generating over weak evidence is exactly how a
 * search answer loses trust, and Korean users already report AI-search trust in
 * the 50s against 70%+ satisfaction.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * The answer is split the same way a notice's own summary is
 * (`NoticeDetailSummary.oneLiner` + `.text`): a headline that answers the
 * question outright, then the qualifications.
 *
 * This is not just formatting. A question like "신청 마감 언제야?" has a
 * one-line answer, and burying it inside a paragraph makes the reader do the
 * extraction the system was supposed to do. The headline also lands first
 * while the body is still streaming, so the answer is usable before
 * generation finishes.
 */
export interface NoticeAnswerCitation {
  sourceId: string;
  articleNo: number;
  /** Short human label, e.g. '학사공지'. */
  label: string;
  /** Display date, already formatted (e.g. '8/2'). */
  date: string;
}

export type NoticeAnswerState =
  /** Backend not deployed, or the query was never submitted. Card renders null. */
  | { status: 'unavailable' }
  /** Request in flight, no tokens yet. Card reserves height. */
  | { status: 'pending' }
  | {
      status: 'streaming';
      headline: string | null;
      text: string;
      citations: NoticeAnswerCitation[];
    }
  | {
      status: 'done';
      headline: string | null;
      text: string;
      citations: NoticeAnswerCitation[];
      followUps: string[];
    }
  /** Retrieval too weak to answer. Card says so; the list still stands. */
  | { status: 'abstained'; reason: 'no_evidence' | 'out_of_scope' }
  | { status: 'error' };

export interface UseNoticeAnswerArgs {
  /** The *submitted* query. Undefined while the user is still typing. */
  query: string | undefined;
  /** Scope the answer should be grounded in. */
  sourceIds: string[];
}

// ── Local preview harness (development builds only) ──────────────────
//
// Flip DEV_MOCK_ENABLED to true to exercise the card's five visible states
// without a backend. `__DEV__` is false in TestFlight and store builds, so
// this cannot leak into a beta even if left on by accident.

/**
 * ⚠️ TIME BOMB — currently ON so the answer UI can be designed and reviewed
 * without a backend. The answers below are FABRICATED: dates, article numbers,
 * and sources are all invented and none of them correspond to real notices.
 *
 * Turn this off (or delete this harness) the moment `useNoticeAnswer`'s real
 * implementation lands. `__DEV__` is false in TestFlight and store builds so
 * it cannot reach a user, but a teammate running the dev build WILL see
 * plausible-looking wrong answers and may believe them.
 */
const DEV_MOCK_ENABLED = true;
/** Terminal state the mock settles into. Flip to preview the other branches. */
const DEV_MOCK_OUTCOME: 'done' | 'abstained' | 'error' = 'done';

const MOCK_PENDING_MS = 900;
/** Per-chunk delay. Roughly a fast model's token cadence. */
const MOCK_TOKEN_MS = 28;
const MOCK_HEADLINE = '8월 12일 10시 ~ 14일 17시';
const MOCK_TEXT =
  '학년별로 시작 시간이 달라요. 4학년은 12일 10시, 3학년은 12일 14시, ' +
  '1~2학년은 13일 10시부터 열려요. 정정 기간은 개강 후 첫 주(9월 1일~5일)이고, ' +
  '이때는 선착순이라 미리 장바구니를 담아두는 편이 좋아요.';
const MOCK_CITATIONS: NoticeAnswerCitation[] = [
  { sourceId: 'skku-notice02', articleNo: 136201, label: '학사', date: '8/2' },
  { sourceId: 'skku-notice02', articleNo: 136180, label: '학사', date: '7/28' },
  { sourceId: 'cse-undergrad', articleNo: 222791, label: '소프트웨어학과', date: '7/25' },
];
const MOCK_FOLLOW_UPS = [
  '장바구니는 언제부터 담을 수 있어?',
  '정정 기간에도 새로 신청할 수 있어?',
  '필요한 서류가 있을까?',
];

function useMockNoticeAnswer(query: string | undefined): NoticeAnswerState {
  const [state, setState] = useState<NoticeAnswerState>({
    status: 'unavailable',
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!query) {
      setState({ status: 'unavailable' });
      return;
    }

    setState({ status: 'pending' });

    const schedule = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, ms));
    };

    schedule(() => {
      if (DEV_MOCK_OUTCOME === 'error') {
        setState({ status: 'error' });
        return;
      }
      if (DEV_MOCK_OUTCOME === 'abstained') {
        setState({ status: 'abstained', reason: 'no_evidence' });
        return;
      }
      // The headline lands whole and immediately — it is one short line, and
      // streaming it character by character would delay the only part the
      // reader actually needs. Only the elaboration streams.
      const chunks = Math.ceil(MOCK_TEXT.length / 6);
      for (let i = 1; i <= chunks; i += 1) {
        schedule(() => {
          const text = MOCK_TEXT.slice(0, i * 6);
          setState(
            i === chunks
              ? {
                  status: 'done',
                  headline: MOCK_HEADLINE,
                  text: MOCK_TEXT,
                  citations: MOCK_CITATIONS,
                  followUps: MOCK_FOLLOW_UPS,
                }
              : {
                  status: 'streaming',
                  headline: MOCK_HEADLINE,
                  text,
                  citations: MOCK_CITATIONS,
                },
          );
        }, i * MOCK_TOKEN_MS);
      }
    }, MOCK_PENDING_MS);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [query]);

  return state;
}

export function useNoticeAnswer({
  query,
  sourceIds,
}: UseNoticeAnswerArgs): NoticeAnswerState {
  // Hook order stays constant: the mock hook always runs, its result is only
  // consulted under the dev flag.
  const mock = useMockNoticeAnswer(
    __DEV__ && DEV_MOCK_ENABLED ? query : undefined,
  );

  if (__DEV__ && DEV_MOCK_ENABLED) return mock;

  // Production: no backend yet. `sourceIds` is referenced so the argument
  // stays part of the contract callers already satisfy — the real
  // implementation grounds the answer in exactly this scope.
  void sourceIds;
  return { status: 'unavailable' };
}
