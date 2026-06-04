/**
 * 인앱 브라우저 페이지 도우미 훅 — 요약 / 추천질문 / 일반 Q&A.
 *
 * useNoticeAi를 미러하되 단일 컨텍스트 동시성을 정면 처리한다: Kanana 네이티브
 * 컨텍스트는 completion을 한 번에 하나만 돌린다. 추천질문(백그라운드 자동) · 요약 ·
 * Q&A가 겹칠 수 있으므로 runExclusive로 직렬화 — 새 작업이 진행 중 작업을 abort(네이티브
 * stopCompletion까지)하고 그 뒤에 이어 실행한다. local-llm-manager의 serialize를 요청
 * 레벨로 가져온 셈.
 *
 * 추출은 화면(WebView 소유)이 담당하고, 이 훅은 content(title/text/url)만 소비한다.
 * content가 바뀌면(새 페이지) AI 상태를 리셋하고, ready+content면 추천질문을 1회 자동 생성.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  acquireLocalLlm,
  useLocalLlmStatus,
  type LlmHandle,
} from '@/services/local-llm-manager';
import { buildPageContext } from './buildPageContext';
import { parseSuggestedQuestions } from './parseSuggestedQuestions';
import { summaryMessages, questionsMessages, qaMessages } from './prompts';

export interface PageContent {
  title: string;
  text: string;
  url: string;
}

export interface AiTurn {
  id: number;
  question: string;
  answer: string;
  /** 생성 중 백그라운드 전환 등으로 중단된 turn. 부분 답변 유지. */
  interrupted?: boolean;
}

export type GenState = 'idle' | 'generating' | 'done' | 'error';

export function usePageAi(content: PageContent | null) {
  const status = useLocalLlmStatus();
  const handleRef = useRef<LlmHandle | null>(null);

  // 단일 활성 작업 직렬화 — abortRef는 현재 작업, chainRef는 이어붙임 체인.
  const abortRef = useRef<AbortController | null>(null);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  const lastHapticRef = useRef(0);
  const turnIdRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const activeTurnIdRef = useRef<number | null>(null);

  const [summary, setSummary] = useState('');
  const [summaryState, setSummaryState] = useState<GenState>('idle');
  const [questions, setQuestions] = useState<string[]>([]);
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const context = useMemo(
    () => (content ? buildPageContext(content.title, content.text) : ''),
    [content],
  );

  // 현재 작업을 preempt(abort)하고 새 작업을 체인 뒤에 실행. 새 작업엔 새 signal 부여.
  const runExclusive = useCallback(
    <T,>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const next = chainRef.current
        .catch(() => {})
        .then(() => fn(ac.signal));
      chainRef.current = next.catch(() => {});
      return next;
    },
    [],
  );

  // ── 핸들 acquire/release (화면 수명과 일치) ──
  useEffect(() => {
    let cancelled = false;
    acquireLocalLlm()
      .then((h) => {
        if (cancelled) h.release();
        else handleRef.current = h;
      })
      .catch(() => {
        /* status는 useLocalLlmStatus로 표면화 */
      });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      handleRef.current?.release();
      handleRef.current = null;
    };
  }, []);

  // ── 새 페이지(content.url 변경) → AI 상태 리셋 ──
  const pageUrl = content?.url ?? null;
  useEffect(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    activeTurnIdRef.current = null;
    setIsGenerating(false);
    setSummary('');
    setSummaryState('idle');
    setQuestions([]);
    setTurns([]);
  }, [pageUrl]);

  // ── 요약 ──
  const summarize = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    if (!context) {
      // 추출 실패(readability+Jina 모두 빈손) — graceful.
      setSummary('');
      setSummaryState('error');
      return;
    }
    setSummary('');
    setSummaryState('generating');
    // 이 호출 고유 signal을 캡처(runExclusive가 abortRef를 재할당하므로 abortRef로
    // 판정하면 후행 작업의 signal을 잘못 읽는다 — useNoticeAi의 로컬 abort 패턴).
    let sig: AbortSignal | undefined;
    try {
      await runExclusive((signal) => {
        sig = signal;
        return handle.streamChat(
          summaryMessages(context),
          (token) => {
            if (!signal.aborted) setSummary((prev) => prev + token);
          },
          { temperature: 0.3, signal },
        );
      });
      if (!sig?.aborted) setSummaryState('done');
    } catch {
      if (!sig?.aborted) setSummaryState('error');
    }
  }, [context, runExclusive]);

  // ── 추천 질문 (백그라운드 자동, url당 1회) ──
  const questionsForUrlRef = useRef<string | null>(null);
  const generateQuestions = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle || !context) return;
    let buf = '';
    let sig: AbortSignal | undefined;
    try {
      await runExclusive((signal) => {
        sig = signal;
        return handle.streamChat(
          questionsMessages(context),
          (token) => {
            buf += token;
          },
          { temperature: 0.4, signal },
        );
      });
      // 중단된 경우 partial buf 파싱 금지(불완전 칩 방지).
      if (!sig?.aborted) {
        const parsed = parseSuggestedQuestions(buf);
        if (parsed.length > 0) setQuestions(parsed);
      }
    } catch {
      /* 실패/중단 — 칩 없이 진행 */
    }
  }, [context, runExclusive]);

  useEffect(() => {
    if (!pageUrl || status.phase !== 'ready' || !context) return;
    if (questionsForUrlRef.current === pageUrl) return;
    questionsForUrlRef.current = pageUrl;
    void generateQuestions();
  }, [pageUrl, status.phase, context, generateQuestions]);

  // ── 일반 Q&A ──
  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question) return;
      const handle = handleRef.current;
      if (!handle) return;

      const id = ++turnIdRef.current;
      if (!context) {
        // 추출 실패 — 질문 버블 + 안내 답변(무응답 방지).
        setTurns((prev) => [
          ...prev,
          { id, question, answer: '이 페이지 내용을 불러오지 못해 답변할 수 없어요.' },
        ]);
        return;
      }
      activeTurnIdRef.current = id;
      setTurns((prev) => [...prev, { id, question, answer: '' }]);
      isGeneratingRef.current = true;
      setIsGenerating(true);

      // 이 호출 고유 signal 캡처(runExclusive abortRef 재할당 대비 — 위 summarize 주석 참조).
      let sig: AbortSignal | undefined;
      try {
        await runExclusive((signal) => {
          sig = signal;
          return handle.streamChat(
            qaMessages(context, question),
            (token) => {
              if (signal.aborted) return;
              if (Platform.OS === 'ios') {
                const now = Date.now();
                if (now - lastHapticRef.current > 100) {
                  lastHapticRef.current = now;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {},
                  );
                }
              }
              setTurns((prev) =>
                prev.map((tn) =>
                  tn.id === id ? { ...tn, answer: tn.answer + token } : tn,
                ),
              );
            },
            { temperature: 0.2, signal },
          );
        });
      } catch {
        if (!sig?.aborted) {
          setTurns((prev) =>
            prev.map((tn) =>
              tn.id === id
                ? {
                    ...tn,
                    answer: tn.answer || '답변 생성에 실패했어요. 다시 시도해 주세요.',
                  }
                : tn,
            ),
          );
        }
      } finally {
        if (!sig?.aborted) {
          isGeneratingRef.current = false;
          activeTurnIdRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [context, runExclusive],
  );

  // ── 진행 중 생성 중단 (백그라운드 전환 방어) ──
  const interruptActive = useCallback(() => {
    if (!isGeneratingRef.current) return;
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    setIsGenerating(false);
    const activeId = activeTurnIdRef.current;
    if (activeId != null) {
      setTurns((prev) =>
        prev.map((tn) => (tn.id === activeId ? { ...tn, interrupted: true } : tn)),
      );
    }
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'active') interruptActive();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [interruptActive]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    activeTurnIdRef.current = null;
    setIsGenerating(false);
  }, []);

  // 대화 기록 초기화 (요약·질문은 유지).
  const reset = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    activeTurnIdRef.current = null;
    setIsGenerating(false);
    setTurns([]);
  }, []);

  return {
    status,
    summary,
    summaryState,
    questions,
    turns,
    isGenerating,
    summarize,
    ask,
    stop,
    reset,
  };
}
