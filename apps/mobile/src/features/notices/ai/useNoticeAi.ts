/**
 * 공지 상세 "SKKU AI" 질문 훅.
 *
 * - mount 시 로컬 LLM 핸들 acquire, unmount 시 release (매니저 ref-count 합산).
 *   공지 탭 진입의 warm-load(NoticesTabScreen)와 별개 참조 — 이미 올라온 모델을 공유.
 * - 단발 Q&A 스트리밍: 각 질문은 독립(공지 컨텍스트 + 현재 질문만 모델에 전달).
 *   단 turns 배열로 누적 저장 → 화면은 Q-A 반복 렌더, 추후 멀티턴 확장 여지.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ChatMessage } from '@skkuverse/shared';
import {
  acquireLocalLlm,
  useLocalLlmStatus,
  type LlmHandle,
} from '@/services/local-llm-manager';
import { buildNoticeContext } from './buildNoticeContext';

export interface AiTurn {
  id: number;
  question: string;
  answer: string;
  /** 생성 중 백그라운드 전환 등으로 중단된 turn. 부분 답변은 유지. */
  interrupted?: boolean;
}

export interface NoticeForAi {
  title: string;
  contentMarkdown: string | null;
  summary: string | null | undefined;
}

// 문서 기반(grounded) 답변 모드. SLM 환각 완화 기법 적용:
//  (1) context-only / negative prompting — 입력에 없는 정보 금지(외부지식·추측 차단)
//  (2) "모르면 모른다" 불확실성 제약 — 환각의 가장 효과적인 단일 완화책
//  (3) 명시적 규칙 번호 + 문서 구분자로 faithfulness 강화
// 근거: arxiv 2510.24476 / Microsoft AI Foundry / GoCodeo 프롬프트 가이드 (web 교차검증).
const SYSTEM_PREFIX =
  '당신은 아래 "공지" 문서만 읽고 답하는 성균관대학교 공지 어시스턴트입니다.\n' +
  '반드시 지켜야 할 규칙:\n' +
  '1. 오직 아래 "공지" 내용만 근거로 답하세요. 문서에 없는 정보·외부 지식·추측은 절대 사용하지 마세요.\n' +
  '2. 공지에 없거나 확실하지 않은 내용은 지어내지 말고 "공지에서 확인할 수 없는 내용이에요."라고만 답하세요.\n' +
  '3. 답은 한국어로 간결하게, 공지에 실제로 적힌 사실만 전달하세요.\n\n' +
  '──── 공지 ────\n';

export function useNoticeAi(notice: NoticeForAi) {
  const status = useLocalLlmStatus();
  const handleRef = useRef<LlmHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnIdRef = useRef(0);
  // AppState 콜백 stale 클로저 회피용 — 진행 상태/활성 turn을 ref로도 추적.
  const isGeneratingRef = useRef(false);
  const activeTurnIdRef = useRef<number | null>(null);
  // 스트리밍 햅틱 throttle 타임스탬프(iOS).
  const lastHapticRef = useRef(0);

  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 진행 중 생성을 중단 처리(부분 답변 유지 + interrupted 마킹). 백그라운드 전환 /
  // 복귀 방어 정리에서 공용으로 호출. abort → §makeStreamChatFn이 네이티브
  // stopCompletion까지 수행해 context를 해제한다(후속 질문 정상화의 핵심).
  const interruptActive = useCallback(() => {
    if (!isGeneratingRef.current) return;
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    setIsGenerating(false);
    const activeId = activeTurnIdRef.current;
    if (activeId != null) {
      setTurns((prev) =>
        prev.map((tn) =>
          tn.id === activeId ? { ...tn, interrupted: true } : tn,
        ),
      );
    }
  }, []);

  // 핸들 acquire/release — 화면 수명과 일치.
  useEffect(() => {
    let cancelled = false;
    acquireLocalLlm()
      .then((h) => {
        if (cancelled) h.release();
        else handleRef.current = h;
      })
      .catch(() => {
        /* 상태는 useLocalLlmStatus로 표면화됨 */
      });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      handleRef.current?.release();
      handleRef.current = null;
    };
  }, []);

  // 백그라운드 전환 시 진행 중 생성 중단. 실제 GPU 서스펜드는 'background'에서만
  // 일어나므로 'inactive'(전화 배너/제어센터 등 transient)는 제외. 복귀('active')
  // 시에는 백그라운드 핸들러가 끝까지 못 돈 edge를 위해 방어적으로 한 번 더 정리
  // (interruptActive는 isGeneratingRef로 가드되어 idempotent).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'active') {
        interruptActive();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [interruptActive]);

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question) return;
      const handle = handleRef.current;
      if (!handle || status.phase !== 'ready') return; // 입력 비활성이라 도달 X, 방어

      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const id = ++turnIdRef.current;
      activeTurnIdRef.current = id;
      setTurns((prev) => [...prev, { id, question, answer: '' }]);
      isGeneratingRef.current = true;
      setIsGenerating(true);

      const context = buildNoticeContext(
        notice.title,
        notice.contentMarkdown,
        notice.summary,
      );
      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PREFIX + context },
        { role: 'user', content: question },
      ];

      try {
        await handle.streamChat(
          messages,
          (token) => {
            if (abort.signal.aborted) return;
            // iOS 고급 햅틱 — 스트리밍 중 미세 진동(ChatGPT 스타일), ~100ms throttle.
            // Android은 미적용.
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
          // 낮은 temperature로 사실성↑(grounded 답변 결정성 강화).
          { temperature: 0.2, signal: abort.signal },
        );
      } catch {
        if (!abort.signal.aborted) {
          setTurns((prev) =>
            prev.map((tn) =>
              tn.id === id
                ? { ...tn, answer: tn.answer || '답변 생성에 실패했어요. 다시 시도해 주세요.' }
                : tn,
            ),
          );
        }
      } finally {
        if (!abort.signal.aborted) {
          isGeneratingRef.current = false;
          activeTurnIdRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [notice.title, notice.contentMarkdown, notice.summary, status.phase],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    activeTurnIdRef.current = null;
    setIsGenerating(false);
  }, []);

  // 대화 기록 초기화 — 진행 중 생성도 중단하고 새로 시작.
  const reset = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    activeTurnIdRef.current = null;
    setIsGenerating(false);
    setTurns([]);
  }, []);

  return { status, turns, isGenerating, ask, stop, reset };
}
