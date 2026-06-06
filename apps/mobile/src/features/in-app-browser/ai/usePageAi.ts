/**
 * 미니앱 페이지 요약 훅 (요약 전용).
 *
 * 추천질문/Q&A는 제거됨 — 하단 "요약" 버튼 탭 시 현재 페이지 본문을 온디바이스 Kanana로
 * 요약만 한다. 단일 작업이라 직렬화(runExclusive) 불필요, abort 기반으로 충분.
 *
 * 추출은 화면(WebView 소유)이 담당하고 이 훅은 content(title/text/url)만 소비한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  // [on-device LLM 비활성화 — 미니앱 AI 요약 주석처리, 추후 복구]
  // acquireLocalLlm,
  useLocalLlmStatus,
  type LlmHandle,
} from '@/services/local-llm-manager';
import { buildPageContext } from './buildPageContext';
import { summaryMessages } from './prompts';

export interface PageContent {
  title: string;
  text: string;
  url: string;
}

export type GenState = 'idle' | 'generating' | 'done' | 'error';

export function usePageAi(content: PageContent | null) {
  const status = useLocalLlmStatus();
  const handleRef = useRef<LlmHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [summary, setSummary] = useState('');
  const [summaryState, setSummaryState] = useState<GenState>('idle');

  const context = useMemo(
    () => (content ? buildPageContext(content.title, content.text) : ''),
    [content],
  );

  // ── 핸들 acquire/release (화면 수명과 일치) ──
  // [on-device LLM 비활성화 — 미니앱 진입 시 모델 로드 트리거 주석처리. 추후 복구.
  //  handleRef가 항상 null이라 summarize()는 무해하게 early-return된다.]
  // useEffect(() => {
  //   let cancelled = false;
  //   acquireLocalLlm()
  //     .then((h) => {
  //       if (cancelled) h.release();
  //       else handleRef.current = h;
  //     })
  //     .catch(() => {
  //       /* status는 useLocalLlmStatus로 표면화 */
  //     });
  //   return () => {
  //     cancelled = true;
  //     abortRef.current?.abort();
  //     handleRef.current?.release();
  //     handleRef.current = null;
  //   };
  // }, []);

  // ── 새 페이지(content.url 변경) → 요약 초기화 ──
  const pageUrl = content?.url ?? null;
  useEffect(() => {
    abortRef.current?.abort();
    setSummary('');
    setSummaryState('idle');
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
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setSummary('');
    setSummaryState('generating');
    try {
      const result = await handle.streamChat(
        summaryMessages(context),
        (token) => {
          if (!abort.signal.aborted) setSummary((prev) => prev + token);
        },
        // 요약은 3~5 불릿이라 출력이 짧다. ANE 모델(ctx1024)에서 nPredict를 낮출수록
        // 입력 예산이 커져(native fitMessages가 contextLength - nPredict로 본문 truncate)
        // 더 긴 페이지를 잘림 없이 요약한다. llama 엔진에선 단순 출력 캡(무해).
        { temperature: 0.3, nPredict: 256, signal: abort.signal },
      );
      if (!abort.signal.aborted) {
        // Reconcile to the authoritative full decode. The ANE engine streams byte-level-BPE
        // deltas that can briefly show U+FFFD for multi-token Korean glyphs; result.text is the
        // complete-buffer decode (always valid UTF-8), so this cleans any residual replacement char.
        setSummary(result.text);
        setSummaryState('done');
      }
    } catch {
      if (!abort.signal.aborted) setSummaryState('error');
    }
  }, [context]);

  // 백그라운드 전환 시 진행 중 요약 중단(GPU 서스펜드 방어).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') abortRef.current?.abort();
    });
    return () => sub.remove();
  }, []);

  return { status, summary, summaryState, summarize };
}
